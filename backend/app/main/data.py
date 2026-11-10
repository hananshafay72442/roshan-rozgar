"""Sample catalog for the homepage. These are fictional workers, not database records."""

SERVICES = [
    {"id": "electrician", "name": "Electrician", "urdu": "الیکٹریشن", "icon": "bolt"},
    {"id": "plumber", "name": "Plumber", "urdu": "پلمبر", "icon": "drop"},
    {"id": "ac-technician", "name": "AC technician", "urdu": "اے سی ٹیکنیشن", "icon": "fan"},
    {"id": "carpenter", "name": "Carpenter", "urdu": "بڑھئی", "icon": "hammer"},
    {"id": "painter", "name": "Painter", "urdu": "رنگ ساز", "icon": "paint"},
    {"id": "mechanic", "name": "Mechanic", "urdu": "مکینک", "icon": "tool"},
]

WORKERS = [
    {"id": 1, "name": "Ahmed Ali", "service_id": "electrician", "city": "Islamabad", "area": "G-10", "experience_years": 8, "available": True},
    {"id": 2, "name": "Muhammad Usman", "service_id": "plumber", "city": "Islamabad", "area": "G-9", "experience_years": 6, "available": True},
    {"id": 3, "name": "Bilal Khan", "service_id": "ac-technician", "city": "Islamabad", "area": "I-8", "experience_years": 10, "available": False},
    {"id": 4, "name": "Tariq Mehmood", "service_id": "carpenter", "city": "Islamabad", "area": "F-10", "experience_years": 12, "available": True},
    {"id": 5, "name": "Hassan Raza", "service_id": "painter", "city": "Islamabad", "area": "G-11", "experience_years": 5, "available": True},
    {"id": 6, "name": "Imran Ashraf", "service_id": "mechanic", "city": "Islamabad", "area": "I-10", "experience_years": 9, "available": True},
    {"id": 7, "name": "Faisal Ahmed", "service_id": "electrician", "city": "Rawalpindi", "area": "Saddar", "experience_years": 7, "available": True},
    {"id": 8, "name": "Shahid Iqbal", "service_id": "plumber", "city": "Rawalpindi", "area": "Satellite Town", "experience_years": 11, "available": False},
    {"id": 9, "name": "Ali Raza", "service_id": "ac-technician", "city": "Rawalpindi", "area": "Chaklala", "experience_years": 6, "available": True},
    {"id": 10, "name": "Asif Mahmood", "service_id": "carpenter", "city": "Rawalpindi", "area": "Bahria Town", "experience_years": 14, "available": True},
    {"id": 11, "name": "Naveed Akhtar", "service_id": "painter", "city": "Rawalpindi", "area": "Westridge", "experience_years": 8, "available": True},
    {"id": 12, "name": "Waqas Haider", "service_id": "mechanic", "city": "Rawalpindi", "area": "Peshawar Road", "experience_years": 4, "available": True},
]

CITIES = ["Islamabad", "Rawalpindi"]
