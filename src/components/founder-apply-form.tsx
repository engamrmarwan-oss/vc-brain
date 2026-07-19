"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";

import { AppHeader } from "@/components/app-header";
import {
  deckSummaryFromUnknown,
  resumeSummaryFromUnknown,
  saveApplication,
  type DeckSummary,
  type ResumeSummary,
  type StoredApplication,
} from "@/components/founder-application-storage";
import type { Assessment, Founder } from "@/lib/types";

type SubmitState = "idle" | "submitting" | "success" | "error";
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

class ApplicationResponseError extends Error {
  constructor(
    message: string,
    readonly application: StoredApplication,
  ) {
    super(message);
    this.name = "ApplicationResponseError";
  }
}

export function FounderApplyForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [companyName, setCompanyName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [whatBuilding, setWhatBuilding] = useState("");
  const [traction, setTraction] = useState("");
  const [stage, setStage] = useState("");
  const [sector, setSector] = useState("");
  const [location, setLocation] = useState("");
  const [deck, setDeck] = useState<File | null>(null);
  const [resume, setResume] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const canSubmit = companyName.trim().length > 1 && deck && submitState !== "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !deck) return;

    setSubmitState("submitting");
    setErrorMessage("");

    try {
      const result = await submitApplication({
        companyName: companyName.trim(),
        deck,
        githubUrl: githubUrl.trim(),
        linkedinUrl: linkedinUrl.trim(),
        whatBuilding: whatBuilding.trim(),
        traction: traction.trim(),
        stage,
        sector: sector.trim(),
        location: location.trim(),
        resume,
      });

      saveApplication(result);
      if (result.status === "local-pending") {
        router.push("/");
        return;
      }
      setSubmitState("success");
    } catch (error) {
      if (error instanceof ApplicationResponseError) {
        saveApplication(error.application);
        setSubmitState("error");
        setErrorMessage(error.message);
        return;
      }

      setSubmitState("error");
      setErrorMessage(
        "We could not preserve this application. Please try once more.",
      );
    }
  }

  function selectDeck(file: File | undefined) {
    if (!file) return;
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setDeck(null);
      setErrorMessage("Please upload the pitch deck as a PDF.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setDeck(null);
      setErrorMessage(
        "Deck must be under 4 MB for now — try an exported or compressed PDF.",
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setDeck(file);
    setErrorMessage("");
  }

  function selectResume(file: File | undefined) {
    if (!file) return;
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setResume(null);
      setErrorMessage("Please upload the resume as a PDF.");
      if (resumeInputRef.current) resumeInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setResume(null);
      setErrorMessage(
        "Resume must be under 4 MB for now — try an exported or compressed PDF.",
      );
      if (resumeInputRef.current) resumeInputRef.current.value = "";
      return;
    }

    setResume(file);
    setErrorMessage("");
  }

  function resetForm() {
    setCompanyName("");
    setGithubUrl("");
    setLinkedinUrl("");
    setWhatBuilding("");
    setTraction("");
    setStage("");
    setSector("");
    setLocation("");
    setDeck(null);
    setResume(null);
    setIsDragging(false);
    setErrorMessage("");
    setSubmitState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (resumeInputRef.current) resumeInputRef.current.value = "";
  }

  return (
    <div className="min-h-screen bg-[#efeee9] text-[#171915]">
      <AppHeader />

      <main className="mx-auto grid w-full max-w-[1200px] gap-7 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12 lg:px-12 lg:py-16">
        <section className="flex flex-col justify-between rounded-[22px] bg-[#20231e] p-7 text-white shadow-[0_18px_42px_rgba(32,35,30,0.16)] sm:p-9 lg:min-h-[670px]">
          <div>
            <div className="mb-8 flex items-center gap-2.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#aeb2aa]">
                Founder view
              </span>
              <span className="h-px w-8 bg-white/20" />
              <span className="flex items-center gap-1.5 text-[9px] font-semibold text-[#74c497]">
                <span className="size-1.5 rounded-full bg-[#6fc091]" />
                Merit-first
              </span>
            </div>

            <h1 className="max-w-md text-[32px] font-semibold leading-[1.03] tracking-[-0.05em] sm:text-[45px]">
              A focused application. Nothing more.
            </h1>
            <p className="mt-5 max-w-md text-[12px] leading-[1.75] text-[#aeb2aa]">
              Deck and name is all we need. Share more and the system verifies
              more — you don&apos;t fill forms, it does the digging.
            </p>

            <div className="mt-10 hidden space-y-1 sm:block">
              <MinimalStep
                detail="The company you are building"
                label="Company"
                number="01"
              />
              <MinimalStep
                detail="Your existing pitch deck"
                label="Deck"
                number="02"
              />
              <MinimalStep
                detail="Add context only when it helps"
                label="Signals"
                number="03"
                optional
              />
            </div>
          </div>

          <div className="mt-10 hidden border-t border-white/10 pt-6 sm:block">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[#78bd96]">
                <ShieldIcon />
              </span>
              <div>
                <p className="text-[10px] font-semibold text-[#e5e8e1]">
                  Founder-blind by design
                </p>
                <p className="mt-1 text-[9.5px] leading-relaxed text-[#8f938b]">
                  The same independent Founder, Market, and Idea-vs-Market screen
                  evaluates every opportunity.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="self-center rounded-[22px] border border-[#d8d6cf] bg-[#f9f8f5] shadow-[0_14px_38px_rgba(40,42,36,0.06)]">
          <div className="border-b border-[#dfddd6] px-6 py-6 sm:px-8 sm:py-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#8b8d85]">
                  {submitState === "success"
                    ? "Founder application"
                    : "New founder application"}
                </p>
                <h2 className="text-[24px] font-semibold tracking-[-0.035em]">
                  {submitState === "success"
                    ? "The system has it from here"
                    : "Start the screen"}
                </h2>
              </div>
              <span className="rounded-full bg-[#e5eee7] px-3 py-1.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-[#42775b]">
                {submitState === "success" ? "Received" : "~90 seconds"}
              </span>
            </div>
            <p className="mt-4 max-w-xl text-[10.5px] leading-relaxed text-[#777971]">
              {submitState === "success"
                ? "No extra steps, status chasing, or investor-side navigation."
                : "Deck and name is all we need. Share more and the system verifies more — you don't fill forms, it does the digging."}
            </p>
          </div>

          {submitState === "success" ? (
            <ApplicationConfirmation
              companyName={companyName}
              onReset={resetForm}
            />
          ) : (
          <form className="px-6 py-6 sm:px-8 sm:py-8" onSubmit={handleSubmit}>
            <div className="space-y-7">
              <FieldGroup
                label="Company name"
                number="01"
                required
                support="The name judges will see in the VC pipeline."
              >
                <div className="relative">
                  <input
                    autoComplete="organization"
                    className="h-12 w-full rounded-xl border border-[#d7d5cd] bg-white px-4 pr-11 text-[13px] font-medium text-[#252721] outline-none transition focus:border-[#7c8b7f] focus:ring-4 focus:ring-[#5f8b70]/10"
                    id="company-name"
                    name="companyName"
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="e.g. Acme AI"
                    required
                    type="text"
                    value={companyName}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#a1a39b]">
                    <CompanyIcon />
                  </span>
                </div>
              </FieldGroup>

              <FieldGroup
                label="Pitch deck"
                number="02"
                required
                support="PDF · under 4 MB."
              >
                <div
                  className={`relative rounded-2xl border border-dashed p-5 transition-colors ${
                    isDragging
                      ? "border-[#4d8b68] bg-[#edf4ee]"
                      : deck
                        ? "border-[#9db9a6] bg-[#f1f6f2]"
                        : "border-[#c9c7bf] bg-[#f3f2ed] hover:border-[#9fa198] hover:bg-[#f6f5f1]"
                  }`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    selectDeck(event.dataTransfer.files[0]);
                  }}
                >
                  <input
                    accept=".pdf,application/pdf"
                    className="sr-only"
                    id="pitch-deck"
                    name="pitchDeck"
                    onChange={(event) => selectDeck(event.target.files?.[0])}
                    ref={fileInputRef}
                    required
                    type="file"
                  />

                  {deck ? (
                    <div className="flex items-center gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#dcebe0] text-[#3d7658]">
                        <FileCheckIcon />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-[#30322c]">
                          {deck.name}
                        </p>
                        <p className="mt-1 text-[9.5px] text-[#7e8178]">
                          {formatFileSize(deck.size)} · ready to submit
                        </p>
                      </div>
                      <button
                        className="rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#6e7169] transition-colors hover:bg-white hover:text-[#30322c]"
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                      >
                        Replace
                      </button>
                    </div>
                  ) : (
                    <label
                      className="flex cursor-pointer flex-col items-center py-3 text-center"
                      htmlFor="pitch-deck"
                    >
                      <span className="mb-3 grid size-10 place-items-center rounded-full bg-white text-[#70736a] shadow-sm ring-1 ring-[#dedcd4]">
                        <UploadIcon />
                      </span>
                      <span className="text-[11px] font-semibold text-[#34362f]">
                        Drop your deck here or{" "}
                        <span className="text-[#4c8263]">choose a file</span>
                      </span>
                      <span className="mt-1.5 text-[9.5px] text-[#92948c]">
                        One deck is enough. No supplementary data room.
                      </span>
                    </label>
                  )}
                </div>
              </FieldGroup>

              <FieldGroup
                label="GitHub or site URL"
                number="03"
                optional
                support="A public signal helps us verify what is already visible."
              >
                <div className="relative">
                  <input
                    autoComplete="url"
                    className="h-12 w-full rounded-xl border border-[#d7d5cd] bg-white px-4 pl-10 text-[13px] text-[#252721] outline-none transition focus:border-[#7c8b7f] focus:ring-4 focus:ring-[#5f8b70]/10"
                    id="github-url"
                    name="githubUrl"
                    onChange={(event) => setGithubUrl(event.target.value)}
                    placeholder="https://github.com/you/project"
                    type="url"
                    value={githubUrl}
                  />
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#979a91]">
                    <LinkIcon />
                  </span>
                </div>
              </FieldGroup>

              <section className="rounded-2xl border border-[#ddd9d0] bg-[#f2f0ea] p-4 sm:p-5">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold text-[#32342e]">
                      Share more signals
                    </p>
                    <p className="mt-1 text-[9.5px] leading-relaxed text-[#85877f]">
                      Everything below is optional. Each signal gives the system
                      another fact to verify—not another form to judge.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-[7.5px] font-bold uppercase tracking-[0.1em] text-[#85877f] ring-1 ring-[#dedbd2]">
                    Optional
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <CompactField
                    id="what-building"
                    label="What you’re building"
                    onChange={setWhatBuilding}
                    placeholder="Inference infrastructure for edge AI"
                    value={whatBuilding}
                  />
                  <CompactField
                    id="traction"
                    label="Traction"
                    onChange={setTraction}
                    placeholder="12 design partners, $18k MRR"
                    value={traction}
                  />

                  <label className="block" htmlFor="stage">
                    <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.1em] text-[#777971]">
                      Stage
                    </span>
                    <select
                      className="h-11 w-full rounded-xl border border-[#d5d2c9] bg-white px-3.5 text-[11px] text-[#34362f] outline-none transition focus:border-[#7c8b7f] focus:ring-4 focus:ring-[#5f8b70]/10"
                      id="stage"
                      name="stage"
                      onChange={(event) => setStage(event.target.value)}
                      value={stage}
                    >
                      <option value="">Select stage</option>
                      <option value="pre-seed">Pre-seed</option>
                      <option value="seed">Seed</option>
                      <option value="series-a">Series A</option>
                      <option value="growth">Growth</option>
                    </select>
                  </label>
                  <CompactField
                    id="sector"
                    label="Sector"
                    onChange={setSector}
                    placeholder="AI infrastructure"
                    value={sector}
                  />
                  <CompactField
                    id="location"
                    label="Location"
                    onChange={setLocation}
                    placeholder="Berlin, Germany"
                    value={location}
                  />
                  <CompactField
                    id="linkedin-url"
                    label="LinkedIn URL"
                    onChange={setLinkedinUrl}
                    placeholder="https://linkedin.com/in/you"
                    type="url"
                    value={linkedinUrl}
                  />
                </div>

                <div className="mt-4 rounded-xl border border-[#d6d3ca] bg-white p-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-[#3e4039]">
                        Resume
                      </p>
                      <p className="mt-1 truncate text-[9px] text-[#8b8d85]">
                        {resume
                          ? `${resume.name} · ${formatFileSize(resume.size)}`
                          : "PDF under 4 MB · career signal only · contact details excluded"}
                      </p>
                    </div>
                    <input
                      accept=".pdf,application/pdf"
                      className="sr-only"
                      id="resume"
                      name="resume"
                      onChange={(event) => selectResume(event.target.files?.[0])}
                      ref={resumeInputRef}
                      type="file"
                    />
                    <button
                      className="shrink-0 rounded-lg border border-[#d8d5cc] bg-[#f7f6f2] px-3 py-2 text-[8.5px] font-bold uppercase tracking-[0.08em] text-[#62655d] transition-colors hover:bg-[#ecebe5]"
                      onClick={() => resumeInputRef.current?.click()}
                      type="button"
                    >
                      {resume ? "Replace" : "Attach PDF"}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {errorMessage && (
              <p
                className="mt-5 flex items-center gap-2 rounded-xl bg-[#f8e7e3] px-3.5 py-3 text-[10px] font-medium text-[#a83f33]"
                role="alert"
              >
                <AlertIcon /> {errorMessage}
              </p>
            )}

            <button
              className="mt-8 flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#20231e] text-[12px] font-semibold text-white shadow-[0_10px_24px_rgba(32,35,30,0.16)] transition-all hover:bg-[#30342d] disabled:cursor-not-allowed disabled:bg-[#c8c7c0] disabled:shadow-none"
              disabled={!canSubmit}
              type="submit"
            >
              {submitState === "submitting" ? (
                <>
                  <SpinnerIcon /> Preparing merit screen…
                </>
              ) : (
                <>
                  Submit for screening <ArrowRightIcon />
                </>
              )}
            </button>

            <p className="mt-4 text-center text-[9px] leading-relaxed text-[#92948c]">
              Your application enters the same screening flow as sourced
              opportunities. No referral weighting.
            </p>
          </form>
          )}
        </section>
      </main>
    </div>
  );
}

async function submitApplication({
  companyName,
  deck,
  githubUrl,
  linkedinUrl,
  location,
  resume,
  sector,
  stage,
  traction,
  whatBuilding,
}: {
  companyName: string;
  deck: File;
  githubUrl: string;
  linkedinUrl: string;
  location: string;
  resume: File | null;
  sector: string;
  stage: string;
  traction: string;
  whatBuilding: string;
}): Promise<StoredApplication> {
  const submittedAt = new Date().toISOString();
  const localFounder = createLocalFounder(
    companyName,
    deck,
    githubUrl,
    sector,
    location,
  );
  const localPending: StoredApplication = {
    founder: localFounder,
    documents: {
      deck: deck.name,
      ...(resume ? { resume: resume.name } : {}),
    },
    submittedAt,
    status: "local-pending",
  };

  try {
    const formData = new FormData();
    formData.append("companyName", companyName);
    formData.append("pitchDeck", deck, deck.name);
    if (resume) formData.append("resume", resume, resume.name);
    if (githubUrl) formData.append("githubUrl", githubUrl);
    if (linkedinUrl) formData.append("linkedinUrl", linkedinUrl);
    if (whatBuilding) formData.append("whatBuilding", whatBuilding);
    if (traction) formData.append("traction", traction);
    if (stage) formData.append("stage", stage);
    if (sector) formData.append("sector", sector);
    if (location) {
      formData.append("location", location);
      formData.append("geo", location);
    }

    const response = await fetch("/api/apply", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const message = await responseErrorMessage(response);
      throw new ApplicationResponseError(message, localPending);
    }

    const payload = (await response.json()) as unknown;
    const founder = founderFromPayload(payload) ?? localFounder;
    const deckSummary = deckSummaryFromApplyPayload(payload);
    const resumeSummary = resumeSummaryFromApplyPayload(payload);
    const assessment = assessmentFromPayload(payload) ?? (await scoreFounder(founder.id));

    return {
      founder,
      assessment,
      deckSummary,
      resumeSummary,
      documents: {
        deck: deck.name,
        ...(resume ? { resume: resume.name } : {}),
      },
      submittedAt,
      status: assessment ? "scored" : "local-pending",
    };
  } catch (error) {
    if (error instanceof ApplicationResponseError) throw error;

    return {
      founder: localFounder,
      documents: {
        deck: deck.name,
        ...(resume ? { resume: resume.name } : {}),
      },
      submittedAt,
      status: "local-pending",
    };
  }
}

async function responseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as unknown;
    if (
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string" &&
      payload.error.trim()
    ) {
      return payload.error.trim();
    }
  } catch {
    // Fall through to a status-aware message when the body is not JSON.
  }

  return `Application upload failed (${response.status}). Please try again.`;
}

function resumeSummaryFromApplyPayload(payload: unknown): ResumeSummary | undefined {
  if (!payload || typeof payload !== "object" || !("resume" in payload)) {
    return undefined;
  }

  const resumePayload = payload.resume;
  if (
    !resumePayload ||
    typeof resumePayload !== "object" ||
    !("summary" in resumePayload)
  ) {
    return undefined;
  }

  return resumeSummaryFromUnknown(resumePayload.summary);
}

function assessmentFromPayload(payload: unknown): Assessment | undefined {
  if (!payload || typeof payload !== "object" || !("assessment" in payload)) {
    return undefined;
  }

  return payload.assessment as Assessment;
}

function deckSummaryFromApplyPayload(payload: unknown): DeckSummary | undefined {
  if (!payload || typeof payload !== "object" || !("deck" in payload)) {
    return undefined;
  }

  const deckPayload = payload.deck;
  if (!deckPayload || typeof deckPayload !== "object" || !("summary" in deckPayload)) {
    return undefined;
  }

  return deckSummaryFromUnknown(deckPayload.summary);
}

async function scoreFounder(id: string): Promise<Assessment | undefined> {
  try {
    const response = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
      cache: "no-store",
    });

    if (!response.ok) return undefined;
    return (await response.json()) as Assessment;
  } catch {
    return undefined;
  }
}

function founderFromPayload(payload: unknown): Founder | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const candidate = (
    "founder" in payload ? payload.founder : payload
  ) as Partial<Founder> | undefined;

  if (
    !candidate ||
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    typeof candidate.company !== "string" ||
    typeof candidate.founderScore !== "number"
  ) {
    return undefined;
  }

  return candidate as Founder;
}

function createLocalFounder(
  companyName: string,
  deck: File,
  githubUrl: string,
  sector: string,
  location: string,
): Founder {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);

  return {
    id: `inbound-${slug || "founder"}-${Date.now().toString(36)}`,
    name: companyName,
    company: companyName,
    sector: sector || "Unclassified",
    geo: location || "Undisclosed",
    entry: "inbound",
    founderScore: 60,
    founderScoreConfidence: 0.5,
    deckClaims: [`Pitch deck uploaded: ${deck.name}`],
    githubUrl: githubUrl || undefined,
  };
}

function CompactField({
  id,
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "text" | "url";
  value: string;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.1em] text-[#777971]">
        {label}
      </span>
      <input
        className="h-11 w-full rounded-xl border border-[#d5d2c9] bg-white px-3.5 text-[11px] text-[#34362f] outline-none transition placeholder:text-[#aaa9a1] focus:border-[#7c8b7f] focus:ring-4 focus:ring-[#5f8b70]/10"
        id={id}
        name={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function ApplicationConfirmation({
  companyName,
  onReset,
}: {
  companyName: string;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-[540px] flex-col items-center justify-center px-6 py-12 text-center sm:px-10">
      <span className="relative mb-6 grid size-16 place-items-center rounded-full bg-[#e3eee6] text-[#3f795a] ring-8 ring-[#eff4ef]">
        <CheckCircleIcon />
        <span className="absolute right-0 top-0 size-3 rounded-full border-2 border-[#f9f8f5] bg-[#64ae82]" />
      </span>

      <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-[#558069]">
        Submission complete
      </p>
      <h3 className="text-[30px] font-semibold tracking-[-0.045em] text-[#20231e] sm:text-[36px]">
        Application received
      </h3>
      <p className="mt-4 max-w-md text-[13px] font-medium leading-[1.7] text-[#555850]">
        {companyName} is being screened now. You&apos;ll hear back within 24 hours.
      </p>
      <p className="mt-3 max-w-sm text-[10.5px] leading-[1.7] text-[#85877f]">
        The system is gathering public signals, checking submitted claims, and
        building the merit screen. Nothing else is needed from you.
      </p>

      <div className="mt-8 flex items-center gap-2 rounded-full bg-[#ecefe9] px-3.5 py-2 text-[9px] font-semibold text-[#607267]">
        <span className="size-1.5 animate-pulse rounded-full bg-[#57a47a]" />
        Evidence screen in progress
      </div>

      <button
        className="mt-9 text-[10px] font-semibold text-[#73766e] underline decoration-[#c7c8c1] underline-offset-4 transition-colors hover:text-[#252721]"
        onClick={onReset}
        type="button"
      >
        Submit another application
      </button>
    </div>
  );
}

function MinimalStep({
  detail,
  label,
  number,
  optional = false,
}: {
  detail: string;
  label: string;
  number: string;
  optional?: boolean;
}) {
  return (
    <div className="grid grid-cols-[30px_1fr_auto] items-center gap-3 border-b border-white/[0.08] py-4 last:border-b-0">
      <span className="text-[9px] font-semibold tabular-nums text-[#70756d]">
        {number}
      </span>
      <div>
        <p className="text-[11px] font-semibold text-[#e2e5de]">{label}</p>
        <p className="mt-1 text-[9px] text-[#858a82]">{detail}</p>
      </div>
      {optional && (
        <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#70756d]">
          Optional
        </span>
      )}
    </div>
  );
}

function FieldGroup({
  children,
  label,
  number,
  optional = false,
  required = false,
  support,
}: {
  children: React.ReactNode;
  label: string;
  number: string;
  optional?: boolean;
  required?: boolean;
  support: string;
}) {
  return (
    <fieldset>
      <div className="mb-2.5 flex items-start justify-between gap-4">
        <div>
          <label
            className="flex items-center gap-2 text-[11px] font-semibold text-[#32342e]"
            htmlFor={number === "01" ? "company-name" : number === "02" ? "pitch-deck" : "github-url"}
          >
            <span className="text-[9px] font-bold tabular-nums text-[#a0a29a]">
              {number}
            </span>
            {label}
            {required && <span className="text-[#dc5b49]">*</span>}
          </label>
          <p className="mt-1 text-[9.5px] text-[#92948c]">{support}</p>
        </div>
        {optional && (
          <span className="rounded-full bg-[#eceae4] px-2 py-1 text-[7.5px] font-bold uppercase tracking-[0.1em] text-[#85877f]">
            Optional
          </span>
        )}
      </div>
      {children}
    </fieldset>
  );
}

function ShieldIcon() {
  return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 16 16" width="15"><path d="M8 1.7 13 3.6v3.8c0 3.1-2 5.8-5 6.9-3-1.1-5-3.8-5-6.9V3.6L8 1.7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.3"/><path d="m5.6 7.8 1.5 1.5 3.4-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3"/></svg>;
}
function CompanyIcon() {
  return <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 16 16" width="15"><path d="M3 14V3h6v11M9 7h4v7M1.8 14h12.4M5 5.5h2M5 8h2M5 10.5h2M11 9.5h.1M11 11.5h.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2"/></svg>;
}
function UploadIcon() {
  return <svg aria-hidden="true" fill="none" height="17" viewBox="0 0 18 18" width="17"><path d="M9 12V3m0 0L5.7 6.3M9 3l3.3 3.3M3 11.5V15h12v-3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4"/></svg>;
}
function FileCheckIcon() {
  return <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 20 20" width="19"><path d="M5 2.5h6l4 4v11H5v-15Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.4"/><path d="M11 2.5v4h4m-7 5 1.5 1.5L12.8 10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4"/></svg>;
}
function CheckCircleIcon() {
  return <svg aria-hidden="true" fill="none" height="28" viewBox="0 0 28 28" width="28"><path d="M23.2 12.9v1.1a9.2 9.2 0 1 1-5.5-8.4" stroke="currentColor" strokeLinecap="round" strokeWidth="2"/><path d="m9.5 13.8 3 3 7.2-7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>;
}
function LinkIcon() {
  return <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14"><path d="m6.5 9.5 3-3M5.2 11.8l-1 .9a2.6 2.6 0 0 1-3.7-3.6L3 6.5a2.6 2.6 0 0 1 3.7 0M10.8 4.2l1-.9a2.6 2.6 0 0 1 3.7 3.6L13 9.5a2.6 2.6 0 0 1-3.7 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3"/></svg>;
}
function AlertIcon() {
  return <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 12 12" width="12"><path d="M6 1 11 10H1L6 1Z" stroke="currentColor" strokeLinejoin="round"/><path d="M6 4v2.7m0 1.3v.1" stroke="currentColor" strokeLinecap="round"/></svg>;
}
function SpinnerIcon() {
  return <svg aria-hidden="true" className="animate-spin" fill="none" height="14" viewBox="0 0 16 16" width="14"><circle cx="8" cy="8" opacity=".25" r="6" stroke="currentColor" strokeWidth="2"/><path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeLinecap="round" strokeWidth="2"/></svg>;
}
function ArrowRightIcon() {
  return <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 14 12" width="14"><path d="M1.5 6h11m0 0L8.7 2.2M12.5 6 8.7 9.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3"/></svg>;
}
