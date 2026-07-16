from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Client, Order, OrderStatus
from app.schemas import OrderCreate, OrderListOut, OrderOut, OrderUpdate

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("", response_model=OrderListOut)
def list_orders(
    client_id: int | None = None,
    status: OrderStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
):
    query = db.query(Order).options(joinedload(Order.client))

    if client_id is not None:
        query = query.filter(Order.client_id == client_id)
    if status is not None:
        query = query.filter(Order.status == status)
    if date_from is not None:
        query = query.filter(Order.order_date >= date_from)
    if date_to is not None:
        query = query.filter(Order.order_date <= date_to)

    total = query.count()
    items = (
        query.order_by(Order.id.asc())
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
    db.commit()
    db.refresh(order)
    return order


@router.put("/{order_id}", response_model=OrderOut)
def update_order(order_id: int, payload: OrderUpdate, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _ensure_client_exists(db, payload.client_id)
    for key, value in payload.model_dump().items():
        setattr(order, key, value)

    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}", status_code=204)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(order)
    db.commit()
    return None
