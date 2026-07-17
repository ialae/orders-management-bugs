from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import OrderStatus

from typing import Annotated

class ClientBase(BaseModel):
    name: str = Field(..., max_length=255)
    email: Annotated[EmailStr, Field(max_length=255)]
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)


class ClientCreate(ClientBase):
    pass


class ClientUpdate(ClientBase):
    pass


class ClientOut(ClientBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class ClientOption(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class ClientListOut(BaseModel):
    items: list[ClientOut]
    total: int
    page: int
    page_size: int


class OrderBase(BaseModel):
    client_id: int
    product_name: str = Field(..., max_length=255)
    quantity: int
    unit_price: float
    status: OrderStatus = OrderStatus.pending
    order_date: date


class OrderCreate(OrderBase):
    pass


class OrderUpdate(OrderBase):
    pass


class OrderOut(OrderBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    client_name: str
    total: float


class OrderListOut(BaseModel):
    items: list[OrderOut]
    total: int
    page: int
    page_size: int
