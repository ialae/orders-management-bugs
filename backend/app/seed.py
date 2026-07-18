import random
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models import Client, Order, OrderStatus

FIRST_NAMES = [
    "Amina", "Youssef", "Sara", "Karim", "Nadia", "Omar", "Leila", "Hamza",
    "Salma", "Ilyas", "Meriem", "Adil", "Fatima", "Rachid", "Imane", "Said",
    "Khadija", "Anas",
]
LAST_NAMES = [
    "Benali", "El Amrani", "Idrissi", "Chraibi", "Bouzid", "Tazi", "Fassi",
    "Cherkaoui", "Alaoui", "Bennis", "Berrada", "Ziani", "Lahlou", "Saadi",
    "Mansouri", "Guessous", "Belhaj", "Naciri",
]
CITIES = ["Casablanca", "Rabat", "Marrakech", "Fes", "Tangier", "Agadir", "Oujda"]

PRODUCTS = [
    "NPK Fertilizer 20-20-20", "Phosphate Rock", "Urea 46%", "Potash Blend",
    "Organic Compost", "Foliar Spray Kit", "Soil Conditioner", "Micronutrient Mix",
    "Drip Irrigation Kit", "Seed Treatment", "Crop Protection Spray", "Liquid Fertilizer",
]


def seed_if_empty(db: Session) -> None:
    if db.query(Client).count() > 0:
        return

    used_phones: set[str] = set()
    clients: list[Client] = []
    for i in range(18):
        first = FIRST_NAMES[i % len(FIRST_NAMES)]
        last = LAST_NAMES[(i * 3) % len(LAST_NAMES)]
        city = CITIES[i % len(CITIES)]
        while True:
            phone = f"+2126{random.randint(10000000, 99999999)}"
            if phone not in used_phones:
                used_phones.add(phone)
                break
        client = Client(
            name=f"{first} {last}",
            email=f"{first.lower()}.{last.lower().replace(' ', '')}{i}@example.com",
            phone=phone,
            address=f"{random.randint(1, 200)} Rue de {city}, {city}",
        )
        db.add(client)
        clients.append(client)

    db.commit()
    for c in clients:
        db.refresh(c)

    statuses = list(OrderStatus)
    today = date.today()
    for i in range(38):
        client = random.choice(clients)
        product = random.choice(PRODUCTS)
        order = Order(
            client_id=client.id,
            product_name=product,
            quantity=random.randint(1, 50),
            unit_price=round(random.uniform(15, 450), 2),
            status=random.choice(statuses),
            order_date=today - timedelta(days=random.randint(0, 120)),
        )
        db.add(order)

    db.commit()
