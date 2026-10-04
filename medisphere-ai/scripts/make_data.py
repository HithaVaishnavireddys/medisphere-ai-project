"""Generate the JSON data files shipped with MediSphere AI.

Run:  python scripts/make_data.py
Authoring the data in Python (raw strings) avoids JSON regex-escaping mistakes.
All clinical text is an EDUCATIONAL summary of widely published guidance
(WHO / AHA / NICE / Surviving Sepsis style). It is NOT medical advice.
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "medisphere" / "data"

# ----------------------------------------------------------------- knowledge base
KB = [
 ("kb-chest-pain", "Chest pain: red flags for acute coronary syndrome", "Cardiology", "Clinical guideline summary",
  "Chest pressure, tightness or heaviness lasting more than a few minutes is a possible heart attack. Features that raise concern: pain spreading to the left arm, jaw or back, sweating, nausea, breathlessness and fainting. Call emergency services immediately and do not drive yourself. Clinicians obtain a 12-lead ECG within 10 minutes of arrival and measure troponin. Aspirin may be given by clinicians unless contraindicated."),
 ("kb-stroke", "Stroke recognition: FAST and time-critical treatment", "Neurology", "Clinical guideline summary",
  "Use FAST: Face drooping, Arm weakness, Speech difficulty, Time to call emergency services. Sudden numbness, confusion, vision loss, severe headache or loss of balance also suggest stroke. Treatment is time-critical: intravenous thrombolysis is considered within 4.5 hours of symptom onset and thrombectomy up to 24 hours in selected patients after urgent brain imaging. Note the exact time the patient was last seen well."),
 ("kb-sepsis", "Sepsis recognition and first-hour care", "Critical Care", "Clinical guideline summary",
  "Suspect sepsis when infection is accompanied by organ dysfunction. The qSOFA screen scores one point each for respiratory rate 22 or more, altered mentation and systolic blood pressure 100 or less; two or more points signals high risk. First-hour actions: measure lactate, take blood cultures, give broad-spectrum antibiotics and start intravenous crystalloid for hypotension or raised lactate. Reassess frequently and escalate to critical care."),
 ("kb-news2", "NEWS2 early warning score and escalation", "Critical Care", "Clinical guideline summary",
  "The National Early Warning Score 2 aggregates respiratory rate, oxygen saturation, supplemental oxygen, systolic blood pressure, pulse, consciousness and temperature. A total of 0 to 4 is low risk, 5 to 6 is medium risk needing urgent clinician review, and 7 or more is high risk needing emergency assessment by a critical care team. A single parameter scoring 3 also triggers urgent review."),
 ("kb-hypertension", "Hypertension: categories and management", "Cardiology", "Clinical guideline summary",
  "Adult blood pressure categories: normal below 120/80 mmHg, elevated 120-129 systolic with diastolic below 80, stage 1 hypertension 130-139 or 80-89, stage 2 hypertension 140/90 or higher. A reading above 180/120 with symptoms such as chest pain, breathlessness, confusion or severe headache is a hypertensive emergency. Diagnosis needs repeated measurements. Lifestyle measures include salt reduction, weight loss, exercise and limiting alcohol."),
 ("kb-diabetes", "Type 2 diabetes: diagnosis and first-line care", "Endocrinology", "Clinical guideline summary",
  "Diabetes is diagnosed by fasting plasma glucose of 126 mg/dL or more, HbA1c of 6.5 percent or more, a 2-hour OGTT glucose of 200 mg/dL or more, or random glucose of 200 mg/dL or more with classic symptoms. Prediabetes is HbA1c 5.7-6.4 percent or fasting glucose 100-125 mg/dL. Metformin is usually first-line therapy alongside diet, activity and weight management. Annual screening covers eyes, kidneys, feet and cardiovascular risk."),
 ("kb-hypoglycemia", "Hypoglycaemia: recognition and the rule of 15", "Endocrinology", "Clinical guideline summary",
  "Hypoglycaemia is blood glucose below 70 mg/dL. Symptoms include shakiness, sweating, hunger, palpitations, confusion and irritability. For a conscious person use the rule of 15: take 15 g of fast-acting carbohydrate, recheck in 15 minutes and repeat if still low. A person who cannot swallow or is unconscious needs intramuscular glucagon or intravenous glucose and emergency help."),
 ("kb-asthma", "Asthma exacerbation: severity and action", "Pulmonology", "Clinical guideline summary",
  "Wheeze, cough, chest tightness and breathlessness that worsen are signs of an asthma attack. Severe features: unable to complete sentences, respiratory rate above 25, pulse above 110 or peak flow below 50 percent of best. Give a short-acting reliever inhaler through a spacer and seek emergency care if there is no quick relief or the person is exhausted or drowsy. Clinicians add oxygen, systemic steroids and nebulised bronchodilators."),
 ("kb-copd", "COPD exacerbation", "Pulmonology", "Clinical guideline summary",
  "An exacerbation of COPD presents with worsening breathlessness, increased cough, and increased sputum volume or purulence. Treatment includes bronchodilators, a short course of oral corticosteroids and antibiotics when sputum is purulent. In oxygen therapy target saturation is 88-92 percent to avoid carbon dioxide retention. Admit if there is respiratory acidosis, confusion or poor response."),
 ("kb-pneumonia", "Community-acquired pneumonia and CURB-65", "Pulmonology", "Clinical guideline summary",
  "Suspect pneumonia with fever, cough, sputum, pleuritic chest pain and breathlessness. CURB-65 assigns one point each for Confusion, Urea above 7 mmol/L, Respiratory rate 30 or more, low Blood pressure (systolic below 90 or diastolic 60 or less) and age 65 or more. Score 0-1 is low risk and may be treated at home, 2 warrants hospital assessment, and 3 or more is severe pneumonia needing urgent admission."),
 ("kb-infant-fever", "Fever in infants under 3 months", "Paediatrics", "Clinical guideline summary",
  "A temperature of 38.0 C or higher in an infant younger than 3 months is an emergency until proven otherwise because serious bacterial infection can be hard to detect. Such infants need urgent in-person assessment, blood and urine tests and often lumbar puncture and antibiotics. Do not give antipyretics to delay assessment. Poor feeding, lethargy, grunting or a bulging fontanelle are danger signs at any age."),
 ("kb-dengue", "Dengue: warning signs and fluid management", "Infectious Disease", "WHO-style guidance summary",
  "Dengue causes sudden high fever with headache, pain behind the eyes, muscle and joint pain and rash. Warning signs around days 3 to 7 include severe abdominal pain, persistent vomiting, mucosal bleeding, lethargy, restlessness, liver enlargement and a rising haematocrit with a rapidly falling platelet count. Manage with oral fluids and paracetamol; avoid aspirin and NSAIDs because of bleeding risk. Admit patients with warning signs for intravenous fluids."),
 ("kb-malaria", "Malaria: fever after travel or in endemic areas", "Infectious Disease", "WHO-style guidance summary",
  "Consider malaria in any febrile patient who lives in or has recently travelled to an endemic area. Confirm with a rapid diagnostic test or blood smear before treating. Severe malaria features include impaired consciousness, repeated convulsions, severe anaemia, jaundice, respiratory distress and shock, and needs intravenous artesunate in hospital."),
 ("kb-uti", "Urinary tract infection", "Urology", "Clinical guideline summary",
  "Uncomplicated cystitis causes burning urination, frequency and urgency without fever. Fever, flank pain, vomiting, pregnancy, male sex, diabetes or catheters suggest a complicated infection or pyelonephritis and need a urine culture and prompt clinician review. Encourage fluids and treat according to local resistance patterns."),
 ("kb-anaphylaxis", "Anaphylaxis: emergency management", "Emergency Medicine", "Clinical guideline summary",
  "Suspect anaphylaxis when skin or mucosal swelling, hives, wheeze, throat tightness, vomiting or low blood pressure appear within minutes to hours of an allergen exposure. First-line treatment is intramuscular adrenaline (epinephrine) into the outer mid-thigh; a typical adult dose is 0.5 mg (0.5 mL of 1 mg/mL) repeated after 5 minutes if needed. Lay the patient flat, call emergency services and give oxygen and fluids."),
 ("kb-abdominal-pain", "Acute abdominal pain: red flags", "Gastroenterology", "Clinical guideline summary",
  "Red flags in abdominal pain are a rigid board-like abdomen, guarding or rebound tenderness, vomiting blood, black tarry stools, persistent vomiting, fever with pain, pain in a pregnant or possibly pregnant woman (consider ectopic pregnancy) and severe pain out of proportion to examination. These need urgent surgical or emergency assessment."),
 ("kb-headache", "Headache: red flags (SNOOP)", "Neurology", "Clinical guideline summary",
  "Most headaches are benign, but the SNOOP mnemonic highlights red flags: Systemic symptoms such as fever, Neurological deficits, Onset that is sudden or thunderclap, Older age with new headache after 50, and Pattern change or progression. A sudden worst headache of life may represent subarachnoid haemorrhage and needs emergency CT."),
 ("kb-meningitis", "Bacterial meningitis", "Infectious Disease", "Clinical guideline summary",
  "Fever, headache, neck stiffness and photophobia are the classic features, with vomiting, confusion and seizures in severe cases. A non-blanching purpuric rash suggests meningococcal disease. This is a medical emergency: give antibiotics without delay, take blood cultures, and arrange imaging and lumbar puncture when safe."),
 ("kb-heart-failure", "Heart failure: symptoms and self-care", "Cardiology", "Clinical guideline summary",
  "Heart failure causes breathlessness on exertion or lying flat, ankle swelling, fatigue and rapid weight gain. Patients should weigh daily and seek advice if weight rises by more than 2 kg in 3 days. Guideline-directed therapy combines an ACE inhibitor or ARNI, a beta-blocker, a mineralocorticoid receptor antagonist and an SGLT2 inhibitor, with diuretics for congestion."),
 ("kb-afib", "Atrial fibrillation and stroke prevention", "Cardiology", "Clinical guideline summary",
  "Atrial fibrillation causes an irregularly irregular pulse, palpitations, breathlessness or fatigue, and sharply raises stroke risk. The CHA2DS2-VASc score (heart failure, hypertension, age, diabetes, prior stroke, vascular disease, sex) guides anticoagulation. Rate or rhythm control is chosen according to symptoms and haemodynamic stability."),
 ("kb-mental-crisis", "Mental health crisis and suicidal thoughts", "Psychiatry", "Clinical guideline summary",
  "Take any mention of suicidal thoughts seriously. Stay with the person, ask directly and calmly, remove access to means where possible and connect them with immediate professional help. In India call Tele-MANAS 14416 or emergency services on 112; in the United States call or text 988. Depression, anxiety and substance use are treatable and early help improves outcomes."),
 ("kb-pregnancy-warning", "Pregnancy danger signs and pre-eclampsia", "Obstetrics", "WHO-style guidance summary",
  "Seek urgent care for vaginal bleeding, severe abdominal pain, severe headache, blurred vision, swelling of face and hands, convulsions, fever, leaking fluid or reduced fetal movements. Blood pressure of 140/90 mmHg or higher after 20 weeks with proteinuria suggests pre-eclampsia, which can progress to eclampsia and is treated with antihypertensives and magnesium sulphate."),
 ("kb-nsaid-safety", "NSAID and paracetamol safety", "Pharmacy", "Medication safety summary",
  "NSAIDs such as ibuprofen and diclofenac can cause gastric bleeding, kidney injury and fluid retention, and should be avoided or used cautiously with anticoagulants, kidney disease, heart failure, ulcers and in late pregnancy. Paracetamol is generally limited to 4 g in 24 hours for healthy adults, with lower limits in liver disease, malnutrition or low body weight. Always check combination cold products for hidden paracetamol."),
 ("kb-antibiotic-stewardship", "Antibiotic stewardship", "Infectious Disease", "WHO-style guidance summary",
  "Most sore throats, colds, bronchitis and coughs are viral and do not need antibiotics. Inappropriate antibiotic use drives antimicrobial resistance. Prescribe only for suspected bacterial infection, choose the narrowest effective agent, document indication and duration, and review at 48-72 hours."),
 ("kb-hand-hygiene", "Hand hygiene: WHO five moments", "Infection Control", "WHO guidance summary",
  "Clean hands before touching a patient, before clean or aseptic procedures, after body fluid exposure, after touching a patient and after touching patient surroundings. Alcohol-based hand rub takes 20-30 seconds; wash with soap and water for 40-60 seconds when hands are visibly soiled or after caring for patients with Clostridioides difficile."),
 ("kb-ckd", "Chronic kidney disease and medicine safety", "Nephrology", "Clinical guideline summary",
  "CKD is staged by eGFR: G1 90 or more, G2 60-89, G3a 45-59, G3b 30-44, G4 15-29, G5 below 15 mL/min/1.73m2, together with albuminuria. Avoid NSAIDs, review renally cleared drugs, and avoid metformin when eGFR is below 30. Control blood pressure and glucose, and use ACE inhibitors or ARBs for proteinuria with potassium monitoring."),
 ("kb-lipids", "Cholesterol and cardiovascular risk", "Cardiology", "Clinical guideline summary",
  "Desirable total cholesterol is below 200 mg/dL, LDL below 100 mg/dL (lower for very high risk), HDL above 40 mg/dL in men and 50 mg/dL in women, and triglycerides below 150 mg/dL. Statins are first-line to lower LDL in people with established cardiovascular disease, diabetes or high calculated risk. Lifestyle change supports but does not replace therapy when risk is high."),
 ("kb-gastroenteritis", "Gastroenteritis and dehydration", "Gastroenterology", "WHO-style guidance summary",
  "Acute diarrhoea and vomiting are managed with oral rehydration solution in small frequent sips. Seek care for blood in stool, high fever, persistent vomiting, severe weakness, sunken eyes, very little urine, or illness in infants, older adults and pregnant women. Zinc supplementation reduces duration in children."),
 ("kb-anaemia", "Anaemia: evaluation", "Haematology", "Clinical guideline summary",
  "Anaemia is haemoglobin below 13 g/dL in men and below 12 g/dL in non-pregnant women. Fatigue, pallor, breathlessness and palpitations are common. Check the red cell indices, ferritin, B12 and folate; iron deficiency in men or postmenopausal women warrants evaluation for gastrointestinal blood loss. Oral iron is first-line for iron deficiency."),
 ("kb-thyroid", "Thyroid function tests", "Endocrinology", "Clinical guideline summary",
  "A raised TSH with low free T4 indicates primary hypothyroidism, causing fatigue, weight gain, cold intolerance and constipation, treated with levothyroxine. A suppressed TSH with high free T4 indicates hyperthyroidism, causing weight loss, tremor, palpitations and heat intolerance. The typical TSH reference range is 0.4-4.0 mIU/L."),
 ("kb-head-injury", "Head injury: when to scan", "Emergency Medicine", "Clinical guideline summary",
  "Seek emergency care after head injury if there is loss of consciousness, repeated vomiting, seizure, worsening headache, confusion, drowsiness, clear fluid from nose or ears, weakness, or the patient is on anticoagulants or over 65. CT head is indicated by decision rules such as Canadian CT Head Rule or NICE criteria."),
 ("kb-seizure", "Seizure first aid and emergency criteria", "Neurology", "Clinical guideline summary",
  "During a seizure stay calm, note the time, move hard objects away and cushion the head. Do not restrain the person or put anything in their mouth. When the shaking stops, place them in the recovery position and stay until fully awake. Call emergency services if the seizure lasts more than 5 minutes, repeats without recovery, is a first-ever seizure, causes injury, happens in water, or occurs in pregnancy or diabetes. Status epilepticus is treated with intravenous benzodiazepines."),
 ("kb-anticoagulants", "Warfarin, aspirin and bleeding risk", "Pharmacy", "Medication safety summary",
  "Warfarin is monitored with the INR, usually targeted between 2.0 and 3.0 for most indications. Taking aspirin, ibuprofen, diclofenac or other NSAIDs with warfarin increases the risk of serious bleeding, and many antibiotics and herbal products change warfarin effect. Patients should report black stools, blood in urine, nosebleeds that do not stop or unusual bruising. Never start or stop aspirin or warfarin without the prescriber's advice, and do not change doses on your own."),
 ("sop-visiting", "SOP: visiting hours and visitor policy", "Hospital SOP (demo)", "MediSphere General Hospital SOP",
  "General wards allow visitors from 4:00 pm to 7:00 pm with a maximum of two visitors per patient at a time. ICU visits are limited to 15 minutes twice daily for immediate family and require hand hygiene and approval from the nurse in charge. Children under 12 are not permitted in ICU or isolation rooms."),
 ("sop-discharge", "SOP: discharge process checklist", "Hospital SOP (demo)", "MediSphere General Hospital SOP",
  "Before discharge the treating doctor confirms clinical stability and signs the discharge summary. Nursing completes medication reconciliation, teaches the patient and family about medicines and warning signs, and books the follow-up appointment. Billing clears insurance pre-authorisation or payment, and the patient receives reports, prescriptions and the summary. Target discharge completion is within 3 hours of the doctor's order."),
 ("sop-identification", "SOP: patient identification and safety", "Hospital SOP (demo)", "MediSphere General Hospital SOP",
  "Use at least two patient identifiers, full name and date of birth or medical record number, before giving medicines, drawing blood, performing procedures or transporting patients. Never use the room number as an identifier. Verify allergies against the wristband and chart before every new medicine."),
 ("sop-privacy", "SOP: patient data privacy and access", "Hospital SOP (demo)", "MediSphere General Hospital SOP",
  "Access to patient records follows the need-to-know principle and every access is logged. Identifiers such as phone number, email and national ID are masked in analytics and AI assistants. Staff must not share records on personal messaging apps. Processing of digital personal data is aligned with the principles of India's Digital Personal Data Protection Act 2023 and HIPAA-style safeguards."),
 ("sop-medication-rec", "SOP: medication reconciliation", "Hospital SOP (demo)", "MediSphere General Hospital SOP",
  "At admission, transfer and discharge, compare the patient's current home medicines with orders. Record drug, dose, route, frequency and last dose taken. Resolve duplications, omissions and interactions, and document the decision. High-alert medicines such as insulin, anticoagulants and opioids need an independent double check."),
]

kb = [
    {"id": i, "title": t, "category": c, "source": s, "text": x}
    for (i, t, c, s, x) in KB
]

# ----------------------------------------------------------------- drug interactions
DRUGS = {
    "warfarin": ["warfarin", "coumadin"],
    "aspirin": ["aspirin", "ecosprin", "acetylsalicylic"],
    "ibuprofen": ["ibuprofen", "brufen", "advil"],
    "diclofenac": ["diclofenac", "voveran"],
    "sildenafil": ["sildenafil", "viagra"],
    "nitroglycerin": ["nitroglycerin", "glyceryl trinitrate", "gtn", "isosorbide"],
    "simvastatin": ["simvastatin"],
    "atorvastatin": ["atorvastatin", "lipitor"],
    "clarithromycin": ["clarithromycin", "klacid"],
    "lisinopril": ["lisinopril", "enalapril", "ramipril", "ace inhibitor"],
    "spironolactone": ["spironolactone", "aldactone"],
    "tramadol": ["tramadol"],
    "sertraline": ["sertraline", "fluoxetine", "escitalopram", "ssri"],
    "clopidogrel": ["clopidogrel", "plavix"],
    "omeprazole": ["omeprazole", "esomeprazole"],
    "methotrexate": ["methotrexate"],
    "digoxin": ["digoxin"],
    "amiodarone": ["amiodarone"],
    "metformin": ["metformin", "glycomet"],
    "paracetamol": ["paracetamol", "acetaminophen", "crocin", "dolo", "tylenol"],
    "amoxicillin": ["amoxicillin", "amoxycillin"],
    "insulin": ["insulin"],
    "ciprofloxacin": ["ciprofloxacin", "cipro"],
    "theophylline": ["theophylline"],
}
INTER = [
    ("warfarin", "aspirin", "Major", "Higher risk of serious bleeding.", "Avoid unless specifically prescribed; monitor INR and bleeding signs."),
    ("warfarin", "ibuprofen", "Major", "NSAIDs raise bleeding risk and can alter INR.", "Avoid; use paracetamol for pain if suitable and consult the prescriber."),
    ("warfarin", "diclofenac", "Major", "NSAIDs raise bleeding risk with warfarin.", "Avoid combination; seek prescriber advice."),
    ("sildenafil", "nitroglycerin", "Contraindicated", "Profound, potentially fatal drop in blood pressure.", "Never combine; nitrates must be avoided for at least 24 hours after sildenafil."),
    ("simvastatin", "clarithromycin", "Major", "Raised statin levels increase the risk of myopathy and rhabdomyolysis.", "Withhold the statin during the antibiotic course or choose another antibiotic."),
    ("lisinopril", "spironolactone", "Major", "Risk of dangerous hyperkalaemia, especially with kidney disease.", "Monitor potassium and renal function closely."),
    ("lisinopril", "ibuprofen", "Moderate", "NSAIDs blunt the antihypertensive effect and raise kidney injury risk.", "Avoid regular NSAID use; monitor kidney function."),
    ("tramadol", "sertraline", "Major", "Risk of serotonin syndrome and seizures.", "Avoid or use with close supervision; know the symptoms of agitation, fever and tremor."),
    ("clopidogrel", "omeprazole", "Moderate", "Omeprazole may reduce activation of clopidogrel.", "Consider pantoprazole as an alternative."),
    ("methotrexate", "ibuprofen", "Major", "NSAIDs reduce methotrexate clearance leading to toxicity.", "Avoid, especially with high-dose methotrexate."),
    ("digoxin", "amiodarone", "Major", "Amiodarone raises digoxin levels, risking toxicity.", "Halve the digoxin dose and monitor levels."),
    ("aspirin", "ibuprofen", "Moderate", "Ibuprofen can interfere with aspirin's antiplatelet effect and increases GI bleeding.", "Take aspirin first and separate doses, or choose another analgesic."),
    ("aspirin", "clopidogrel", "Moderate", "Dual antiplatelet therapy increases bleeding.", "Use only when indicated; review need and duration regularly."),
    ("ciprofloxacin", "theophylline", "Major", "Ciprofloxacin increases theophylline levels causing toxicity.", "Monitor theophylline levels or select a different antibiotic."),
    ("warfarin", "amoxicillin", "Moderate", "Antibiotics can enhance warfarin effect.", "Check INR within 3-5 days of starting."),
    ("warfarin", "paracetamol", "Minor", "Regular high-dose paracetamol can raise INR.", "Occasional use is generally acceptable; monitor INR with regular use."),
]
interactions = {
    "drugs": DRUGS,
    "pairs": [{"a": a, "b": b, "severity": s, "effect": e, "advice": adv} for (a, b, s, e, adv) in INTER],
}

# ----------------------------------------------------------------- rules
def sym(id, label, patterns, weight, category, dept, rf=False, floor=5):
    return {"id": id, "label": label, "patterns": patterns, "weight": weight,
            "category": category, "department": dept, "red_flag": rf, "level_floor": floor}

SYMPTOMS = [
    sym("stroke", "Stroke signs", [r"face (is )?droop", r"facial droop", r"slurred speech", r"arm weakness", r"one[- ]sided weakness", r"sudden (numbness|weakness)", r"can'?t speak", r"trouble speaking"], 5, "Neurological", "Neurology / Stroke Unit", True, 1),
    sym("seizure", "Seizure", [r"seizure", r"convuls"], 5, "Neurological", "Neurology", True, 1),
    sym("bleeding", "Severe bleeding", [r"heavy bleeding", r"bleeding (won'?t|will not) stop", r"vomit(ing)? blood", r"cough(ing)? (up )?blood", r"blood in (the )?(stool|vomit)", r"black (tarry )?stool"], 5, "Haemorrhage", "Emergency Medicine", True, 1),
    sym("anaphylaxis", "Possible anaphylaxis", [r"swelling of (the )?(lips|tongue|throat)", r"throat (is )?(closing|swelling|tight)", r"tongue (is )?swollen", r"anaphyla"], 5, "Allergic", "Emergency Medicine", True, 1),
    sym("thunderclap", "Sudden severe headache", [r"thunderclap", r"worst headache", r"sudden severe headache"], 5, "Neurological", "Neurology", True, 2),
    sym("chest_pain", "Chest pain", [r"chest (pain|pressure|tightness|discomfort|heaviness)", r"heart attack", r"tight chest"], 4, "Cardiac", "Cardiology", True, 2),
    sym("dyspnoea", "Breathlessness", [r"short(ness)? of breath", r"breathless", r"difficulty breathing", r"can'?t breathe", r"struggling to breathe", r"trouble breathing"], 4, "Respiratory", "Pulmonology", True, 2),
    sym("syncope", "Fainting / collapse", [r"\bfaint", r"passed out", r"blackout", r"collapse", r"loss of consciousness"], 4, "Neurological", "Emergency Medicine", True, 2),
    sym("confusion", "Confusion / altered consciousness", [r"confus", r"disorient", r"altered mental", r"drowsy", r"unresponsive", r"not responding"], 4, "Neurological", "Emergency Medicine", True, 2),
    sym("suicidal", "Suicidal thoughts / self-harm", [r"suicid", r"kill myself", r"end my life", r"want to die", r"self[- ]harm"], 5, "Mental health", "Psychiatry", True, 2),
    sym("pregnancy_bleed", "Pregnancy with bleeding or pain", [r"pregnan\w*.{0,40}(bleed|pain|cramp)", r"(bleed|pain|cramp)\w*.{0,40}pregnan"], 5, "Obstetric", "Obstetrics & Gynaecology", True, 2),
    sym("severe_abdomen", "Severe abdominal pain", [r"severe (abdominal|stomach|belly) pain", r"rigid (abdomen|stomach)", r"board[- ]like"], 4, "Gastrointestinal", "General Surgery", True, 2),
    sym("head_injury", "Head injury", [r"head injury", r"hit (my |his |her )?head", r"fell and hit"], 3, "Trauma", "Emergency Medicine", True, 3),
    sym("fracture", "Possible fracture", [r"fractur", r"broken (bone|arm|leg|wrist|ankle)", r"deformity"], 3, "Trauma", "Orthopaedics", True, 3),
    sym("neck_stiffness", "Neck stiffness", [r"stiff neck", r"neck stiffness", r"photophobia", r"light hurts"], 3, "Neurological", "Neurology", False, 5),
    sym("radiating", "Pain radiating to arm / jaw", [r"(pain|pressure).{0,30}(left arm|jaw|back)", r"left arm", r"jaw pain"], 2, "Cardiac", "Cardiology", False, 5),
    sym("sweating", "Sweating", [r"sweat", r"clammy"], 1, "General", "General Medicine", False, 5),
    sym("palpitations", "Palpitations", [r"palpitation", r"racing heart", r"heart (is )?racing", r"irregular heart"], 2, "Cardiac", "Cardiology", False, 5),
    sym("fever", "Fever", [r"fever", r"high temperature", r"febrile", r"chills", r"shivering"], 2, "Infectious", "General Medicine", False, 5),
    sym("cough", "Cough", [r"cough"], 1, "Respiratory", "Pulmonology", False, 5),
    sym("sore_throat", "Sore throat", [r"sore throat", r"throat pain", r"runny nose", r"blocked nose"], 2, "ENT", "ENT", False, 5),
    sym("headache", "Headache", [r"headache", r"migraine"], 1, "Neurological", "Neurology", False, 5),
    sym("abdominal_pain", "Abdominal pain", [r"abdominal pain", r"stomach (pain|ache)", r"belly pain", r"tummy ache"], 2, "Gastrointestinal", "Gastroenterology", False, 5),
    sym("vomiting", "Nausea / vomiting", [r"vomit", r"nausea", r"nauseous"], 1, "Gastrointestinal", "Gastroenterology", False, 5),
    sym("diarrhoea", "Diarrhoea", [r"diarrh", r"loose motion", r"loose stool"], 1, "Gastrointestinal", "Gastroenterology", False, 5),
    sym("dysuria", "Urinary symptoms", [r"burning (urination|when i pee|while urinating)", r"painful urination", r"frequent urination", r"burning pee"], 2, "Urological", "Urology", False, 5),
    sym("rash", "Rash / itching", [r"\brash", r"hives", r"itch"], 1, "Dermatological", "Dermatology", False, 5),
    sym("back_pain", "Back / joint pain", [r"back pain", r"joint pain", r"knee pain", r"muscle pain", r"body ache", r"body pain"], 1, "Musculoskeletal", "Orthopaedics", False, 5),
    sym("dizziness", "Dizziness", [r"dizz", r"vertigo", r"light[- ]?headed"], 1, "Neurological", "General Medicine", False, 5),
    sym("thirst", "Excessive thirst / urination", [r"excessive thirst", r"very thirsty", r"passing (a lot of )?urine", r"always thirsty"], 2, "Endocrine", "Endocrinology", False, 5),
    sym("leg_swelling", "Leg / ankle swelling", [r"swollen (leg|ankle|feet)", r"(leg|ankle|feet) swelling"], 2, "Cardiac", "Cardiology", False, 5),
    sym("fatigue", "Fatigue", [r"fatigue", r"tired", r"weakness", r"lethargy"], 1, "General", "General Medicine", False, 5),
]

COMBOS = [
    {"all": ["chest_pain", "sweating"], "level": 1, "reason": "Chest pain with sweating: possible acute coronary syndrome"},
    {"all": ["chest_pain", "radiating"], "level": 1, "reason": "Chest pain radiating to arm/jaw: possible acute coronary syndrome"},
    {"all": ["chest_pain", "dyspnoea"], "level": 1, "reason": "Chest pain with breathlessness: possible ACS or pulmonary embolism"},
    {"all": ["fever", "neck_stiffness"], "level": 1, "reason": "Fever with neck stiffness: possible meningitis"},
    {"all": ["fever", "confusion"], "level": 1, "reason": "Fever with confusion: possible sepsis or CNS infection"},
    {"all": ["dyspnoea", "fever"], "level": 2, "reason": "Fever with breathlessness: possible pneumonia or sepsis"},
]

NEWS2 = {
    "resp_rate": [[0, 9, 3], [9, 12, 1], [12, 21, 0], [21, 25, 2], [25, 999, 3]],
    "spo2": [[0, 92, 3], [92, 94, 2], [94, 96, 1], [96, 101, 0]],
    "sbp": [[0, 91, 3], [91, 101, 2], [101, 111, 1], [111, 220, 0], [220, 999, 3]],
    "pulse": [[0, 41, 3], [41, 51, 1], [51, 91, 0], [91, 111, 1], [111, 131, 2], [131, 999, 3]],
    "temp": [[0, 35.05, 3], [35.05, 36.05, 1], [36.05, 38.05, 0], [38.05, 39.05, 1], [39.05, 99, 2]],
}

LEVELS = {
    "1": {"name": "Immediate", "color": "#B3261E", "target": "Immediate resuscitation / emergency team", "disposition": "Emergency Department, resuscitation bay now"},
    "2": {"name": "Emergent", "color": "#D9480F", "target": "Clinician within 15 minutes", "disposition": "Emergency Department, fast-track assessment"},
    "3": {"name": "Urgent", "color": "#B7791F", "target": "Clinician within 60 minutes", "disposition": "Urgent care / same-day specialist review"},
    "4": {"name": "Less urgent", "color": "#2F7D5B", "target": "Clinician within 2 hours", "disposition": "Outpatient clinic, same-day appointment"},
    "5": {"name": "Non-urgent", "color": "#1F6F8B", "target": "Routine or tele-consultation", "disposition": "Teleconsultation or routine appointment"},
}

SYNONYMS = {
    "heart attack": ["myocardial infarction", "acute coronary syndrome", "chest pain"],
    "angina": ["chest pain", "coronary"],
    "high blood pressure": ["hypertension"],
    "bp": ["blood pressure", "hypertension"],
    "sugar": ["glucose", "diabetes"],
    "diabetic": ["diabetes"],
    "low sugar": ["hypoglycaemia", "hypoglycemia"],
    "hypoglycemia": ["hypoglycaemia"],
    "stroke": ["fast", "thrombolysis"],
    "breathing": ["breathlessness", "dyspnoea", "asthma"],
    "wheezing": ["asthma"],
    "uti": ["urinary", "cystitis"],
    "fever": ["temperature", "febrile"],
    "baby": ["infant", "paediatric"],
    "newborn": ["infant"],
    "child": ["paediatric", "infant"],
    "visiting": ["visitors", "visiting hours"],
    "visitor": ["visitors", "visiting hours"],
    "discharge": ["discharge process"],
    "privacy": ["data", "confidential"],
    "cholesterol": ["lipids", "statin", "ldl"],
    "kidney": ["ckd", "egfr", "renal"],
    "thyroid": ["tsh", "levothyroxine"],
    "anemia": ["anaemia", "haemoglobin"],
    "allergy": ["anaphylaxis", "allergen"],
    "mosquito": ["dengue", "malaria"],
    "depressed": ["depression", "suicidal"],
    "sepsis": ["qsofa", "infection"],
    "pregnant": ["pregnancy"],
    "painkiller": ["nsaid", "paracetamol", "analgesic"],
    "antibiotics": ["antibiotic", "stewardship"],
    "washing hands": ["hand hygiene"],
}

STOPWORDS = ("a an and are as at be by for from has have how i in is it its my of on or that the this to was what when which who with you your do does can should should me about if am we our their they them there than then into over after before while during any some such not no yes please tell give explain want need best treat good tips use used using").split()

GUARD = {
    "injection": [r"ignore (all |the )?(previous|above|prior) (instructions|rules)", r"disregard (your|the) (instructions|rules|guidelines)", r"reveal (your )?(system )?prompt", r"you are now", r"jailbreak", r"act as (an? )?(unrestricted|dan)", r"pretend (you have no|there are no) (rules|restrictions)"],
    "pii": {
        "email": r"[\w.+-]+@[\w-]+\.[\w.-]+",
        "phone": r"(?<!\d)(?:\+?91[-\s]?)?[6-9]\d{9}(?!\d)",
        "aadhaar": r"(?<!\d)\d{4}\s\d{4}\s\d{4}(?!\d)",
        "ssn": r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)",
        "mrn": r"\b(?:MRN|UHID)[:\s#-]*\w{5,12}\b",
        "dob": r"\b(?:0?[1-9]|[12]\d|3[01])[/-](?:0?[1-9]|1[0-2])[/-](?:19|20)\d{2}\b",
    },
    "dosing": r"\b(how (much|many)|what dose|dosage|dose of|mg)\b",
    "personal": r"\b(my|i |i'm|im|for me|my (wife|husband|son|daughter|mother|father|baby|child))\b",
    "emergency_numbers": "India: 112 (emergency) or 108 (ambulance); USA: 911",
}

LABS = [
    {"id": "hb", "name": "Haemoglobin", "aliases": ["haemoglobin", "hemoglobin", "hb"], "unit": "g/dL", "low": 12.0, "high": 15.5, "low_m": 13.5, "high_m": 17.5, "kb": "kb-anaemia"},
    {"id": "wbc", "name": "WBC count", "aliases": ["wbc", "total leucocyte count", "tlc", "white blood cell"], "unit": "x10^9/L", "low": 4.0, "high": 11.0, "kb": "kb-sepsis"},
    {"id": "plt", "name": "Platelets", "aliases": ["platelet count", "platelets", "plt"], "unit": "x10^9/L", "low": 150, "high": 450, "kb": "kb-dengue"},
    {"id": "glu", "name": "Fasting glucose", "aliases": ["fasting blood sugar", "fasting glucose", "fbs", "fasting plasma glucose", "glucose"], "unit": "mg/dL", "low": 70, "high": 99, "kb": "kb-diabetes"},
    {"id": "hba1c", "name": "HbA1c", "aliases": ["hba1c", "hbalc", "a1c", "glycated haemoglobin", "glycosylated hemoglobin"], "unit": "%", "low": 4.0, "high": 5.6, "kb": "kb-diabetes"},
    {"id": "creat", "name": "Creatinine", "aliases": ["creatinine", "serum creatinine"], "unit": "mg/dL", "low": 0.6, "high": 1.1, "low_m": 0.7, "high_m": 1.3, "kb": "kb-ckd"},
    {"id": "chol", "name": "Total cholesterol", "aliases": ["total cholesterol", "cholesterol"], "unit": "mg/dL", "low": 0, "high": 199, "kb": "kb-lipids"},
    {"id": "ldl", "name": "LDL cholesterol", "aliases": ["ldl cholesterol", "ldl"], "unit": "mg/dL", "low": 0, "high": 99, "kb": "kb-lipids"},
    {"id": "hdl", "name": "HDL cholesterol", "aliases": ["hdl cholesterol", "hdl"], "unit": "mg/dL", "low": 50, "high": 999, "low_m": 40, "high_m": 999, "kb": "kb-lipids"},
    {"id": "tg", "name": "Triglycerides", "aliases": ["triglycerides", "triglyceride"], "unit": "mg/dL", "low": 0, "high": 149, "kb": "kb-lipids"},
    {"id": "na", "name": "Sodium", "aliases": ["sodium", "na+"], "unit": "mmol/L", "low": 135, "high": 145, "kb": "kb-gastroenteritis"},
    {"id": "k", "name": "Potassium", "aliases": ["potassium", "k+"], "unit": "mmol/L", "low": 3.5, "high": 5.0, "kb": "kb-ckd"},
    {"id": "tsh", "name": "TSH", "aliases": ["tsh", "thyroid stimulating hormone"], "unit": "mIU/L", "low": 0.4, "high": 4.0, "kb": "kb-thyroid"},
    {"id": "alt", "name": "ALT (SGPT)", "aliases": ["alt", "sgpt"], "unit": "U/L", "low": 7, "high": 56, "kb": "kb-nsaid-safety"},
]

rules = {
    "symptoms": SYMPTOMS, "combos": COMBOS, "news2": NEWS2, "levels": LEVELS,
    "synonyms": SYNONYMS, "stopwords": STOPWORDS, "guard": GUARD, "labs": LABS,
    "departments": sorted({s["department"] for s in SYMPTOMS}),
}

def dump(name, obj):
    (OUT / name).write_text(json.dumps(obj, indent=1, ensure_ascii=False), encoding="utf-8")

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    dump("knowledge_base.json", kb)
    dump("drug_interactions.json", interactions)
    dump("rules.json", rules)
    print(f"wrote {len(kb)} KB docs, {len(interactions['pairs'])} interaction pairs, {len(SYMPTOMS)} symptoms")
