import React, { useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  GraduationCap,
  Loader2,
  Upload,
} from "lucide-react";
import { uploadStudyPlanMaterial } from "../../../api/apiService";

const DAYS = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

const INITIAL_FORM = {
  examName: "",
  subject: "",
  studyStartDate: "",
  examDate: "",
  dailyStudyMinutes: "",
  unavailableDays: [],
};

const StudyPlanWizard = ({ onBack, onPlanCreated }) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [materials, setMaterials] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const today = new Date();
  const todayValue = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const toggleUnavailableDay = (day) => {
    const unavailableDays = form.unavailableDays.includes(day)
      ? form.unavailableDays.filter((item) => item !== day)
      : [...form.unavailableDays, day];

    updateField("unavailableDays", unavailableDays);
  };

  const handleMaterialUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setMaterials((current) => [
        ...current,
        { name: file.name, status: "error", error: "Only PDF files are supported." },
      ]);
      return;
    }

    const materialId = `${file.name}-${file.lastModified}`;
    setMaterials((current) => [
      ...current,
      { id: materialId, name: file.name, status: "processing" },
    ]);
    setIsUploading(true);

    try {
      const processed = await uploadStudyPlanMaterial(file);
      setMaterials((current) =>
        current.map((material) =>
          material.id === materialId
            ? {
                ...material,
                status: "ready",
                extractedText: processed.extractedText,
                fileSize: processed.fileSize,
              }
            : material
        )
      );
    } catch (error) {
      setMaterials((current) =>
        current.map((material) =>
          material.id === materialId
            ? { ...material, status: "error", error: error.message || "Processing failed." }
            : material
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.examName.trim()) {
      nextErrors.examName = "Enter an exam name.";
    }
    if (!form.subject.trim()) {
      nextErrors.subject = "Enter a subject.";
    }
    if (!form.studyStartDate) {
      nextErrors.studyStartDate = "Select a study start date.";
    }
    if (!form.examDate) {
      nextErrors.examDate = "Select an exam date.";
    } else if (
      form.studyStartDate &&
      new Date(`${form.examDate}T00:00:00`) <=
        new Date(`${form.studyStartDate}T00:00:00`)
    ) {
      nextErrors.examDate = "Exam date must be after the study start date.";
    }

    const minutes = Number(form.dailyStudyMinutes);
    if (!form.dailyStudyMinutes) {
      nextErrors.dailyStudyMinutes = "Enter your daily study time.";
    } else if (!Number.isFinite(minutes) || minutes < 15 || minutes > 720) {
      nextErrors.dailyStudyMinutes = "Enter between 15 and 720 minutes.";
    }

    if (form.unavailableDays.length === DAYS.length) {
      nextErrors.unavailableDays = "Keep at least one day available for studying.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    onPlanCreated({
      id: `draft-${Date.now()}`,
      examName: form.examName.trim(),
      subject: form.subject.trim(),
      studyStartDate: form.studyStartDate,
      examDate: form.examDate,
      dailyStudyMinutes: Number(form.dailyStudyMinutes),
      unavailableDays: form.unavailableDays,
      materials: materials
        .filter((material) => material.status === "ready")
        .map(({ id, status, ...material }) => material),
      createdAt: new Date().toISOString(),
      status: "draft",
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold text-[#52705f] transition hover:bg-[#edf4ef]"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to planner
      </button>

      <div className="mt-3 border-b border-[#dce5df] pb-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#52705f]">
          <CalendarDays className="h-4 w-4" />
          Study planner
        </div>
        <h1 className="mt-2 text-3xl font-bold text-[#18231d]">
          Create a study plan
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68766d]">
          Tell us about your exam and the time you can study. You can add study
          activities after the plan is created.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-8">
        <section aria-labelledby="exam-details-heading">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-md bg-[#dff0e4] p-2 text-[#287247]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h2 id="exam-details-heading" className="font-bold text-[#26372d]">
                Exam details
              </h2>
              <p className="text-sm text-[#718077]">
                Add the information that defines your study period.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              htmlFor="exam-name"
              label="Exam name"
              error={errors.examName}
            >
              <input
                id="exam-name"
                type="text"
                value={form.examName}
                onChange={(event) => updateField("examName", event.target.value)}
                placeholder="For example, Calculus midterm"
                required
                aria-invalid={Boolean(errors.examName)}
                className={inputClasses(errors.examName)}
              />
            </Field>

            <Field htmlFor="subject" label="Subject" error={errors.subject}>
              <input
                id="subject"
                type="text"
                value={form.subject}
                onChange={(event) => updateField("subject", event.target.value)}
                placeholder="For example, Mathematics"
                required
                aria-invalid={Boolean(errors.subject)}
                className={inputClasses(errors.subject)}
              />
            </Field>

            <Field
              htmlFor="study-start-date"
              label="Study start date"
              error={errors.studyStartDate}
            >
              <input
                id="study-start-date"
                type="date"
                min={todayValue}
                value={form.studyStartDate}
                onChange={(event) =>
                  updateField("studyStartDate", event.target.value)
                }
                required
                aria-invalid={Boolean(errors.studyStartDate)}
                className={inputClasses(errors.studyStartDate)}
              />
            </Field>

            <Field
              htmlFor="exam-date"
              label="Exam date"
              error={errors.examDate}
            >
              <input
                id="exam-date"
                type="date"
                min={form.studyStartDate || todayValue}
                value={form.examDate}
                onChange={(event) => updateField("examDate", event.target.value)}
                required
                aria-invalid={Boolean(errors.examDate)}
                className={inputClasses(errors.examDate)}
              />
            </Field>
          </div>
        </section>

        <section
          aria-labelledby="study-materials-heading"
          className="border-t border-[#dce5df] pt-7"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-md bg-[#fff0d9] p-2 text-[#9a641c]">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 id="study-materials-heading" className="font-bold text-[#26372d]">
                Study materials
              </h2>
              <p className="text-sm text-[#718077]">
                Upload PDFs so the planner can use their extracted text.
              </p>
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[#b9cbbd] bg-[#fbfdfb] px-4 py-5 text-sm font-semibold text-[#385445] transition hover:bg-[#f1f6f2]">
            <Upload className="h-4 w-4" />
            Upload a PDF
            <input type="file" accept="application/pdf,.pdf" onChange={handleMaterialUpload} className="sr-only" />
          </label>

          {materials.length > 0 && (
            <ul className="mt-3 space-y-2" aria-live="polite">
              {materials.map((material) => (
                <li key={material.id || material.name} className="flex items-start gap-2 rounded-md border border-[#dce5df] bg-white px-3 py-2 text-sm">
                  {material.status === "processing" && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[#52705f]" />}
                  {material.status === "ready" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#287247]" />}
                  {material.status === "error" && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#b54747]" />}
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[#33443a]">{material.name}</p>
                    <p className={material.status === "error" ? "text-xs text-[#b54747]" : "text-xs text-[#718077]"}>
                      {material.status === "processing" ? "Processing..." : material.status === "ready" ? "Text extracted and connected to this plan" : material.error}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="study-availability-heading"
          className="border-t border-[#dce5df] pt-7"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-md bg-[#e7eef8] p-2 text-[#315f95]">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="study-availability-heading"
                className="font-bold text-[#26372d]"
              >
                Study availability
              </h2>
              <p className="text-sm text-[#718077]">
                Set a realistic daily target and mark the days you cannot study.
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(220px,0.7fr)_1.3fr]">
            <Field
              htmlFor="daily-study-time"
              label="Daily study time"
              error={errors.dailyStudyMinutes}
            >
              <div className="relative">
                <input
                  id="daily-study-time"
                  type="number"
                  min="15"
                  max="720"
                  step="5"
                  value={form.dailyStudyMinutes}
                  onChange={(event) =>
                    updateField("dailyStudyMinutes", event.target.value)
                  }
                  placeholder="60"
                  required
                  aria-invalid={Boolean(errors.dailyStudyMinutes)}
                  className={`${inputClasses(errors.dailyStudyMinutes)} pr-24`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[#718077]">
                  minutes
                </span>
              </div>
            </Field>

            <fieldset>
              <legend className="text-sm font-semibold text-[#33443a]">
                Unavailable days <span className="font-normal text-[#819087]">(optional)</span>
              </legend>
              <p className="mt-1 text-xs text-[#718077]">
                Select every day when you cannot schedule study activities.
              </p>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {DAYS.map((day) => {
                  const selected = form.unavailableDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleUnavailableDay(day.value)}
                      className={`min-h-11 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                        selected
                          ? "border-[#274c3a] bg-[#274c3a] text-white"
                          : "border-[#cfdad2] bg-white text-[#526259] hover:bg-[#f1f6f2]"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              {errors.unavailableDays && (
                <ErrorText>{errors.unavailableDays}</ErrorText>
              )}
            </fieldset>
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 border-t border-[#dce5df] pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-[#cfdad2] bg-white px-5 py-2.5 text-sm font-semibold text-[#526259] transition hover:bg-[#f3f7f4]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isUploading || materials.some((material) => material.status === "processing")}
            className="rounded-md bg-[#274c3a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d3c2d]"
          >
            Create plan
          </button>
        </div>
      </form>
    </div>
  );
};

const Field = ({ htmlFor, label, error, children }) => (
  <div>
    <label htmlFor={htmlFor} className="text-sm font-semibold text-[#33443a]">
      {label} <span className="text-[#b54747]">*</span>
    </label>
    <div className="mt-2">{children}</div>
    {error && <ErrorText>{error}</ErrorText>}
  </div>
);

const ErrorText = ({ children }) => (
  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#b54747]">
    <AlertCircle className="h-3.5 w-3.5" />
    {children}
  </p>
);

const inputClasses = (hasError) =>
  `w-full rounded-md border bg-white px-3 py-2.5 text-sm text-[#26372d] outline-none transition placeholder:text-[#a3ada7] focus:ring-2 ${
    hasError
      ? "border-[#cf6666] focus:border-[#cf6666] focus:ring-[#f1cccc]"
      : "border-[#cfdad2] focus:border-[#5f8f72] focus:ring-[#d6e9dc]"
  }`;

export default StudyPlanWizard;
