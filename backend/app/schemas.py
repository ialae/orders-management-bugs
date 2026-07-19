from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import OrderStatus


class ClientBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.lower()


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
    product_name: str = Field(min_length=1, max_length=255)
    quantity: int = Field(gt=0)
    unit_price: float = Field(gt=0)
    status: OrderStatus = OrderStatus.pending
    order_date: date

    @field_validator("product_name", mode="before")
    @classmethod
    def strip_product_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


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
