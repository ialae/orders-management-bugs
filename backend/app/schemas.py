from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.types import Decimal as PydanticDecimal

from app.models import OrderStatus


def _strip_and_reject_blank(value: str, field_name: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError(f"{field_name} must not be blank")
    return stripped


class ClientBase(BaseModel):
    name: str = Field(max_length=255)
    email: EmailStr = Field(max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return _strip_and_reject_blank(value, "Name")

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        return _strip_and_reject_blank(value, "Email").lower()


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        return _strip_and_reject_blank(value, "Name")

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        return _strip_and_reject_blank(value, "Email").lower()


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
    product_name: str = Field(max_length=255)
    quantity: int = Field(gt=0)
    unit_price: PydanticDecimal = Field(gt=Decimal("0"), max_digits=12, decimal_places=2)
    status: OrderStatus = OrderStatus.pending
    order_date: date

    @field_validator("product_name", mode="before")
    @classmethod
    def strip_product_name(cls, value: str) -> str:
        return _strip_and_reject_blank(value, "Product name")


class OrderCreate(OrderBase):
    pass


class OrderUpdate(BaseModel):
    client_id: int | None = None
    product_name: str | None = Field(default=None, max_length=255)
    quantity: int | None = Field(default=None, gt=0)
    unit_price: PydanticDecimal | None = Field(default=None, gt=Decimal("0"), max_digits=12, decimal_places=2)
    status: OrderStatus | None = None
    order_date: date | None = None

    @field_validator("product_name", mode="before")
    @classmethod
    def strip_product_name(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        return _strip_and_reject_blank(value, "Product name")


class OrderOut(OrderBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    client_name: str
    total: PydanticDecimal = Field(max_digits=14, decimal_places=2)


class OrderListOut(BaseModel):
    items: list[OrderOut]
    total: int
    page: int
    page_size: int
