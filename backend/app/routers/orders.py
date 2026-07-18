from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Client, Order, OrderStatus
from app.schemas import OrderCreate, OrderListOut, OrderOut, OrderUpdate

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("", response_model=OrderListOut)
def list_orders(
    client_id: int | None = Query(default=None, gt=0),
    status: OrderStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from cannot be after date_to")

    # Build the base query with filters only (no joinedload) for an accurate count
    base_query = db.query(Order)

    if client_id is not None:
        base_query = base_query.filter(Order.client_id == client_id)
    if status is not None:
        base_query = base_query.filter(Order.status == status)
    if date_from is not None:
        base_query = base_query.filter(Order.order_date >= date_from)
    if date_to is not None:
        base_query = base_query.filter(Order.order_date <= date_to)

    total = base_query.count()
    items = (
        base_query.options(joinedload(Order.client))
        .order_by(Order.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return OrderListOut(items=items, total=total, page=page, page_size=page_size)


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = (
        db.query(Order).options(joinedload(Order.client)).filter(Order.id == order_id).first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _ensure_client_exists(db: Session, client_id: int) -> None:
    if not db.get(Client, client_id):
        raise HTTPException(status_code=400, detail="Selected client does not exist")


@router.post("", response_model=OrderOut, status_code=201)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    _ensure_client_exists(db, payload.client_id)
    order = Order(**payload.model_dump())
    db.add(order)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to create order")
    db.refresh(order)
    # Reload with client relationship to populate client_name
    order = db.query(Order).options(joinedload(Order.client)).filter(Order.id == order.id).first()
    return order


@router.put("/{order_id}", response_model=OrderOut)
def update_order(order_id: int, payload: OrderUpdate, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _ensure_client_exists(db, payload.client_id)
    for key, value in payload.model_dump().items():
        setattr(order, key, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Unable to update order")
    db.refresh(order)
    # Reload with client relationship to populate client_name
    order = db.query(Order).options(joinedload(Order.client)).filter(Order.id == order.id).first()
    return order


@router.delete("/{order_id}", status_code=204)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(order)
    db.commit()
    return None
