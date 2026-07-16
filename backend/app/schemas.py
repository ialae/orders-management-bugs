from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import OrderStatus


class ClientBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
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
    model_config = ConfigDict(extra="forbid")

    items: list[ClientOut]
    total: int
    page: int
    page_size: int


class OrderBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_id: int = Field(gt=0)
    product_name: str = Field(min_length=1, max_length=255)
    quantity: int = Field(gt=0)
    unit_price: float = Field(gt=0)
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
    model_config = ConfigDict(extra="forbid")

    items: list[OrderOut]
    total: int
    page: int
    page_size: int
