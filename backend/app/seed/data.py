"""Realistic, deterministic sample data.

Twenty hand-written patients (with clinical notes) are always seeded. Additional synthetic
patients are generated with a fixed RNG seed up to SEED_PATIENT_COUNT so the list views can
be exercised at realistic volume. Dates are relative to "today" so the data never looks stale.
"""

import random
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta

from app.models import BloodType, Note, Patient, PatientStatus


@dataclass
class SeedPatient:
    first: str
    last: str
    dob: str
    blood: str
    status: str
    city: str
    state: str
    conditions: list[str]
    allergies: list[str]
    last_visit_days_ago: int | None
    notes: list[tuple[int, str]] = field(default_factory=list)  # (days ago, content)


CURATED: list[SeedPatient] = [
    SeedPatient(
        "Margaret",
        "Chen",
        "1952-03-14",
        "A+",
        "active",
        "Portland",
        "OR",
        ["Hypertension", "Type 2 diabetes"],
        ["Penicillin"],
        6,
        [
            (
                120,
                "Annual review. BP 148/92 on lisinopril 10 mg. HbA1c 7.8%. Increased lisinopril to 20 mg and reinforced dietary advice.",
            ),
            (
                45,
                "Follow-up for BP. Home readings averaging 132/84. HbA1c improved to 7.2%. Continue current regimen.",
            ),
            (
                6,
                "Reports mild ankle swelling for two weeks. No shortness of breath. Ordered BMP and echocardiogram to rule out cardiac cause.",
            ),
        ],
    ),
    SeedPatient(
        "James",
        "Okafor",
        "1987-07-22",
        "O+",
        "active",
        "Atlanta",
        "GA",
        ["Asthma"],
        [],
        30,
        [
            (
                200,
                "Asthma flare after viral URI. Prescribed 5-day prednisone burst. Albuterol use 3x daily.",
            ),
            (
                30,
                "Asthma well controlled on budesonide-formoterol. Uses rescue inhaler less than once a week. Spirometry normal.",
            ),
        ],
    ),
    SeedPatient(
        "Sofia",
        "Ramirez",
        "1995-11-03",
        "B+",
        "active",
        "San Antonio",
        "TX",
        ["Migraine"],
        ["Sulfa drugs"],
        14,
        [
            (
                14,
                "Migraines increasing to 6 per month, triggered by poor sleep. Started propranolol 40 mg daily as prophylaxis; headache diary advised.",
            ),
        ],
    ),
    SeedPatient(
        "Robert",
        "Kowalski",
        "1946-01-28",
        "A-",
        "critical",
        "Milwaukee",
        "WI",
        ["Congestive heart failure", "Atrial fibrillation", "Chronic kidney disease stage 3"],
        ["Aspirin", "Iodine contrast"],
        2,
        [
            (
                60,
                "CHF stable, NYHA class II. Weight 82 kg. Continue furosemide 40 mg and apixaban.",
            ),
            (
                9,
                "Weight up 3 kg in one week with worsening orthopnea. Furosemide increased to 80 mg. Daily weights requested.",
            ),
            (
                2,
                "Presented with dyspnea at rest and bilateral crackles. SpO2 89% on room air. Referred to ED for admission and IV diuresis.",
            ),
        ],
    ),
    SeedPatient(
        "Aisha",
        "Patel",
        "1979-05-09",
        "AB+",
        "active",
        "Edison",
        "NJ",
        ["Hypothyroidism"],
        [],
        90,
        [
            (
                90,
                "TSH 5.8 on levothyroxine 75 mcg. Increased dose to 88 mcg; repeat TSH in 6 weeks.",
            ),
        ],
    ),
    SeedPatient(
        "William",
        "Turner",
        "1961-09-17",
        "O-",
        "inactive",
        "Boise",
        "ID",
        ["Hyperlipidemia"],
        ["Statins"],
        410,
        [
            (
                410,
                "LDL 172. Statin intolerance (myalgia). Started ezetimibe 10 mg. Patient relocating; records to be transferred.",
            ),
        ],
    ),
    SeedPatient(
        "Emily",
        "Nguyen",
        "2001-02-25",
        "A+",
        "active",
        "San Jose",
        "CA",
        [],
        ["Peanuts", "Latex"],
        21,
        [
            (
                21,
                "Sports physical. Healthy. Anaphylaxis action plan reviewed; EpiPen prescription renewed.",
            ),
        ],
    ),
    SeedPatient(
        "David",
        "Goldberg",
        "1958-12-02",
        "B-",
        "active",
        "Brooklyn",
        "NY",
        ["COPD", "Hypertension"],
        [],
        10,
        [
            (
                180,
                "COPD GOLD 2. Former smoker, 40 pack-years. On tiotropium. Pneumococcal vaccine given.",
            ),
            (
                10,
                "Productive cough and increased dyspnea for 4 days. No fever. Started doxycycline and short prednisone course.",
            ),
        ],
    ),
    SeedPatient(
        "Grace",
        "Mensah",
        "1990-08-30",
        "O+",
        "active",
        "Columbus",
        "OH",
        ["Iron deficiency anemia"],
        [],
        35,
        [
            (
                95,
                "Fatigue for 3 months. Hb 9.8, ferritin 6. Started oral iron; GI review advised given heavy menses history.",
            ),
            (35, "Energy improved. Hb 11.6, ferritin 24. Continue iron for 3 more months."),
        ],
    ),
    SeedPatient(
        "Thomas",
        "Müller",
        "1973-04-11",
        "A+",
        "discharged",
        "Denver",
        "CO",
        ["Lumbar disc herniation"],
        ["Codeine"],
        150,
        [
            (
                240,
                "Acute L5 radiculopathy after lifting. MRI shows L4-L5 herniation. Referred to physiotherapy; NSAIDs.",
            ),
            (
                150,
                "Symptoms resolved after 10 weeks of physiotherapy. Discharged from care with home exercise program.",
            ),
        ],
    ),
    SeedPatient(
        "Hannah",
        "O'Brien",
        "1984-10-19",
        "B+",
        "active",
        "Boston",
        "MA",
        ["Generalized anxiety disorder"],
        [],
        28,
        [
            (85, "GAD-7 score 15. Started sertraline 50 mg and referred for CBT."),
            (28, "GAD-7 down to 8. Tolerating sertraline well. Attending weekly CBT. Continue."),
        ],
    ),
    SeedPatient(
        "Kenji",
        "Tanaka",
        "1966-06-06",
        "AB-",
        "active",
        "Seattle",
        "WA",
        ["Type 2 diabetes", "Diabetic neuropathy"],
        ["Metformin"],
        50,
        [
            (
                50,
                "HbA1c 8.4% on sitagliptin. Reports tingling in both feet. Monofilament reduced sensation. Started empagliflozin; podiatry referral.",
            ),
        ],
    ),
    SeedPatient(
        "Olivia",
        "Brooks",
        "2016-03-21",
        "O+",
        "active",
        "Nashville",
        "TN",
        ["Eczema"],
        ["Eggs"],
        40,
        [
            (
                40,
                "Pediatric visit. Flexural eczema flare. Emollients and hydrocortisone 1% for 7 days. Growth on 60th centile.",
            ),
        ],
    ),
    SeedPatient(
        "Marcus",
        "Johnson",
        "1999-12-12",
        "A-",
        "active",
        "Chicago",
        "IL",
        [],
        [],
        3,
        [
            (
                3,
                "Right ankle inversion injury playing basketball. Ottawa rules negative. RICE, ibuprofen, review in 2 weeks if not improving.",
            ),
        ],
    ),
    SeedPatient(
        "Fatima",
        "Haddad",
        "1970-07-04",
        "B+",
        "critical",
        "Dearborn",
        "MI",
        ["Breast cancer (on chemotherapy)", "Neutropenia"],
        ["Ondansetron"],
        1,
        [
            (
                30,
                "Cycle 3 of adjuvant chemotherapy. Fatigue and nausea manageable with metoclopramide.",
            ),
            (
                1,
                "Fever 38.6°C. ANC 0.4. Febrile neutropenia protocol initiated; admitted for IV antibiotics. Oncology informed.",
            ),
        ],
    ),
    SeedPatient(
        "George",
        "Whitfield",
        "1940-11-23",
        "O-",
        "inactive",
        "Savannah",
        "GA",
        ["Osteoarthritis", "Macular degeneration"],
        [],
        365,
        [
            (
                365,
                "Bilateral knee OA limiting mobility. Walker provided. Moved to assisted living with in-house physician.",
            ),
        ],
    ),
    SeedPatient(
        "Priya",
        "Sharma",
        "1992-01-15",
        "A+",
        "active",
        "Raleigh",
        "NC",
        ["Pregnancy (second trimester)"],
        [],
        7,
        [
            (
                60,
                "Confirmed intrauterine pregnancy, 10 weeks. Started prenatal vitamins. Booking bloods sent.",
            ),
            (
                7,
                "22 weeks. Anatomy scan normal. BP 112/70. Glucose tolerance test scheduled at 26 weeks.",
            ),
        ],
    ),
    SeedPatient(
        "Lucas",
        "Fernandes",
        "1982-09-08",
        "B-",
        "active",
        "Miami",
        "FL",
        ["Gout"],
        ["Allopurinol"],
        18,
        [
            (
                18,
                "Acute gout of left first MTP joint. Uric acid 9.1. Colchicine started; febuxostat to be considered after flare settles.",
            ),
        ],
    ),
    SeedPatient(
        "Ingrid",
        "Larsen",
        "1956-02-02",
        "A-",
        "active",
        "Minneapolis",
        "MN",
        ["Osteoporosis", "Hypertension"],
        ["NSAIDs"],
        75,
        [
            (
                75,
                "DEXA T-score -2.8 at hip. Started alendronate weekly with calcium and vitamin D. Fall risk assessment completed.",
            ),
        ],
    ),
    SeedPatient(
        "Samuel",
        "Adeyemi",
        "2005-05-27",
        "O+",
        "discharged",
        "Houston",
        "TX",
        ["Appendectomy (recovered)"],
        [],
        100,
        [
            (
                130,
                "Post-op review 2 weeks after laparoscopic appendectomy. Wounds healing well. No fever.",
            ),
            (100, "Fully recovered. Returned to school and sport. Discharged from follow-up."),
        ],
    ),
]

# ---- synthetic data -------------------------------------------------------------------------

FIRST_NAMES = [
    "Liam",
    "Noah",
    "Ethan",
    "Mason",
    "Lucas",
    "Elijah",
    "Logan",
    "Mia",
    "Ava",
    "Isabella",
    "Amelia",
    "Harper",
    "Evelyn",
    "Abigail",
    "Ella",
    "Chloe",
    "Zoe",
    "Nora",
    "Leah",
    "Ruth",
    "Daniel",
    "Henry",
    "Jack",
    "Owen",
    "Wyatt",
    "Ivan",
    "Mateo",
    "Yusuf",
    "Arjun",
    "Wei",
    "Mei",
    "Yuki",
    "Amara",
    "Kofi",
    "Nia",
    "Diego",
    "Camila",
    "Valentina",
    "Omar",
    "Layla",
]
LAST_NAMES = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Martinez",
    "Lopez",
    "Wilson",
    "Anderson",
    "Thomas",
    "Moore",
    "Jackson",
    "Lee",
    "Harris",
    "Clark",
    "Lewis",
    "Walker",
    "Hall",
    "Young",
    "King",
    "Wright",
    "Scott",
    "Kim",
    "Singh",
    "Ali",
    "Nakamura",
    "Rossi",
    "Dubois",
    "Novak",
    "Ivanova",
    "Mbeki",
    "Silva",
    "Cohen",
    "Murphy",
]
CITIES = [
    ("Austin", "TX"),
    ("Phoenix", "AZ"),
    ("Charlotte", "NC"),
    ("Detroit", "MI"),
    ("Sacramento", "CA"),
    ("Pittsburgh", "PA"),
    ("Tampa", "FL"),
    ("Omaha", "NE"),
    ("Salt Lake City", "UT"),
    ("Richmond", "VA"),
    ("Madison", "WI"),
    ("Albuquerque", "NM"),
]
CONDITIONS = [
    "Hypertension",
    "Type 2 diabetes",
    "Asthma",
    "Hyperlipidemia",
    "Hypothyroidism",
    "Depression",
    "Obesity",
    "GERD",
    "Osteoarthritis",
    "Chronic back pain",
    "Migraine",
    "Atrial fibrillation",
    "COPD",
    "Sleep apnea",
]
ALLERGIES = ["Penicillin", "Sulfa drugs", "Latex", "Peanuts", "Shellfish", "Pollen", "Aspirin"]
NOTE_TEMPLATES = [
    "Routine check-up. Vitals within normal limits. No new complaints.",
    "Follow-up for {c}. Symptoms stable on current management. Continue plan.",
    "Medication review for {c}. Good adherence reported; no side effects.",
    "Patient reports intermittent fatigue. Labs ordered: CBC, TSH, BMP.",
    "Flu vaccine administered. No immediate reaction observed.",
    "Discussed lifestyle modification: diet, exercise and sleep hygiene.",
]
BLOOD_WEIGHTS = {
    "O+": 37,
    "A+": 36,
    "B+": 9,
    "AB+": 3,
    "O-": 6,
    "A-": 5,
    "B-": 2,
    "AB-": 1,
    "unknown": 1,
}
STATUS_WEIGHTS = {"active": 70, "inactive": 15, "critical": 5, "discharged": 10}


def _patient_from_seed(s: SeedPatient, today: date, idx: int) -> Patient:
    slug = f"{s.first}.{s.last}".lower().replace("'", "").replace("ü", "u")
    patient = Patient(
        first_name=s.first,
        last_name=s.last,
        date_of_birth=date.fromisoformat(s.dob),
        email=f"{slug}@example.com",
        phone=f"+1 (555) {100 + idx:03d}-{1000 + idx * 37 % 9000:04d}",
        address_line1=f"{100 + idx * 13} Maple Street",
        city=s.city,
        state=s.state,
        postal_code=f"{10000 + idx * 991 % 89999:05d}",
        blood_type=BloodType(s.blood),
        status=PatientStatus(s.status),
        conditions=s.conditions,
        allergies=s.allergies,
        last_visit=today - timedelta(days=s.last_visit_days_ago)
        if s.last_visit_days_ago is not None
        else None,
    )
    for days_ago, content in s.notes:
        stamp = datetime.combine(today - timedelta(days=days_ago), time(9 + days_ago % 8, 30), UTC)
        patient.notes.append(Note(timestamp=stamp, content=content))
    return patient


def _synthetic_patient(rng: random.Random, today: date, idx: int) -> Patient:
    first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
    city, state = rng.choice(CITIES)
    dob = today - timedelta(days=rng.randint(1 * 365, 95 * 365))
    conditions = rng.sample(CONDITIONS, k=rng.choice([0, 0, 1, 1, 2, 3]))
    allergies = rng.sample(ALLERGIES, k=rng.choice([0, 0, 0, 1, 2]))
    status = rng.choices(list(STATUS_WEIGHTS), weights=list(STATUS_WEIGHTS.values()))[0]
    days_since_visit = rng.randint(0, 720) if rng.random() > 0.05 else None
    last_visit = None
    if days_since_visit is not None:
        last_visit = max(today - timedelta(days=days_since_visit), dob)

    patient = Patient(
        first_name=first,
        last_name=last,
        date_of_birth=dob,
        email=f"{first}.{last}{idx}@example.com".lower(),
        phone=f"+1 (555) {rng.randint(200, 999)}-{rng.randint(1000, 9999)}",
        address_line1=f"{rng.randint(1, 9999)} {rng.choice(['Oak', 'Pine', 'Cedar', 'Elm'])} Ave",
        city=city,
        state=state,
        postal_code=f"{rng.randint(10000, 99999)}",
        blood_type=BloodType(
            rng.choices(list(BLOOD_WEIGHTS), weights=list(BLOOD_WEIGHTS.values()))[0]
        ),
        status=PatientStatus(status),
        conditions=conditions,
        allergies=allergies,
        last_visit=last_visit,
    )
    if last_visit is not None:
        for i in range(rng.randint(0, 3)):
            when = last_visit - timedelta(days=i * rng.randint(20, 120))
            if when < dob:
                break
            text = rng.choice(NOTE_TEMPLATES).format(c=conditions[0] if conditions else "wellness")
            patient.notes.append(
                Note(
                    timestamp=datetime.combine(when, time(rng.randint(8, 17), 0), UTC), content=text
                )
            )
    return patient


def build_patients(total: int, today: date | None = None) -> list[Patient]:
    today = today or date.today()
    patients = [_patient_from_seed(s, today, i) for i, s in enumerate(CURATED)]
    rng = random.Random(42)
    patients += [_synthetic_patient(rng, today, i) for i in range(max(0, total - len(patients)))]
    return patients
