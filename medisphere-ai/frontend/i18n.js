/* Interface languages. Navigation, titles and key actions are translated; clinical knowledge-base text stays in English
 * until clinically reviewed translations are supplied (see docs/DEPLOYMENT.md). Arabic switches the layout to RTL. */
(function (root) {
  "use strict";
  const D = {
    en: { _name: "English", dashboard: "Command Center", assistant: "Clinical Assistant", triage: "AI Triage", documents: "Document AI", workflow: "Patient Intake", queue: "Live Queue", patients: "Patient Registry", agent: "Research Agent", search: "Knowledge Search", lab: "Prompt Lab", admin: "Administration", arch: "Architecture",
      g_overview: "Overview", g_clinical: "Clinical tools", g_intel: "Intelligence", g_system: "System", signin: "Sign in", signout: "Sign out", username: "Username", password: "Password", language: "Language", waiting: "Waiting", in_treatment: "In treatment", critical_waiting: "Critical waiting",
      safety: "Educational decision-support demo using synthetic data. It does not replace clinical judgement. Emergency: {n}.", start: "Start treatment", discharge: "Discharge", search_ph: "Search by name or MRN", site: "Site" },
    hi: { _name: "हिन्दी", dashboard: "कमांड सेंटर", assistant: "क्लिनिकल सहायक", triage: "एआई ट्राइएज", documents: "दस्तावेज़ एआई", workflow: "रोगी पंजीकरण", queue: "लाइव कतार", patients: "रोगी रजिस्ट्री", agent: "शोध एजेंट", search: "ज्ञान खोज", lab: "प्रॉम्प्ट लैब", admin: "प्रशासन", arch: "आर्किटेक्चर",
      g_overview: "अवलोकन", g_clinical: "क्लिनिकल उपकरण", g_intel: "इंटेलिजेंस", g_system: "सिस्टम", signin: "साइन इन", signout: "साइन आउट", username: "उपयोगकर्ता नाम", password: "पासवर्ड", language: "भाषा", waiting: "प्रतीक्षा में", in_treatment: "उपचार में", critical_waiting: "गंभीर, प्रतीक्षा में",
      safety: "यह कृत्रिम डेटा पर आधारित शैक्षिक निर्णय-सहायता डेमो है। यह चिकित्सकीय निर्णय का विकल्प नहीं है। आपातकाल: {n}।", start: "उपचार शुरू करें", discharge: "डिस्चार्ज", search_ph: "नाम या MRN से खोजें", site: "साइट" },
    ar: { _name: "العربية", dashboard: "مركز القيادة", assistant: "المساعد السريري", triage: "الفرز بالذكاء الاصطناعي", documents: "ذكاء المستندات", workflow: "تسجيل المرضى", queue: "قائمة الانتظار المباشرة", patients: "سجل المرضى", agent: "وكيل البحث", search: "البحث المعرفي", lab: "مختبر الأوامر", admin: "الإدارة", arch: "البنية",
      g_overview: "نظرة عامة", g_clinical: "الأدوات السريرية", g_intel: "الذكاء", g_system: "النظام", signin: "تسجيل الدخول", signout: "تسجيل الخروج", username: "اسم المستخدم", password: "كلمة المرور", language: "اللغة", waiting: "قيد الانتظار", in_treatment: "قيد العلاج", critical_waiting: "حالات حرجة تنتظر",
      safety: "عرض تعليمي لدعم القرار السريري يستخدم بيانات اصطناعية، ولا يغني عن الحكم الطبي. الطوارئ: {n}.", start: "بدء العلاج", discharge: "خروج", search_ph: "ابحث بالاسم أو رقم الملف", site: "الموقع" },
    es: { _name: "Español", dashboard: "Centro de mando", assistant: "Asistente clínico", triage: "Triaje con IA", documents: "IA de documentos", workflow: "Admisión de pacientes", queue: "Cola en vivo", patients: "Registro de pacientes", agent: "Agente de investigación", search: "Búsqueda de conocimiento", lab: "Laboratorio de prompts", admin: "Administración", arch: "Arquitectura",
      g_overview: "Resumen", g_clinical: "Herramientas clínicas", g_intel: "Inteligencia", g_system: "Sistema", signin: "Iniciar sesión", signout: "Cerrar sesión", username: "Usuario", password: "Contraseña", language: "Idioma", waiting: "En espera", in_treatment: "En tratamiento", critical_waiting: "Críticos en espera",
      safety: "Demostración educativa de apoyo a decisiones con datos sintéticos. No sustituye el juicio clínico. Emergencias: {n}.", start: "Iniciar tratamiento", discharge: "Dar de alta", search_ph: "Buscar por nombre o MRN", site: "Sede" },
  };
  const I18N = { lang: "en", langs: Object.keys(D).map((k) => [k, D[k]._name]),
    t(key, vars) { let s = (D[this.lang] && D[this.lang][key]) || D.en[key] || key; if (vars) for (const k in vars) s = s.replace("{" + k + "}", vars[k]); return s; },
    set(l) { if (!D[l]) l = "en"; this.lang = l; document.documentElement.lang = l; document.documentElement.dir = l === "ar" ? "rtl" : "ltr"; } };
  root.I18N = I18N;
})(window);
