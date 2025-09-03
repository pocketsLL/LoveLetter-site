import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Love Letter — Submissions & Directory (MVP)
 * Refined aesthetic per your direction:
 *  - Background: off-white (neutral-50)
 *  - Typography: monospace / typewriter feel
 *  - Colour: headings in pink; body/UI mostly neutral to lower contrast
 *  - Art type: dropdown (now includes Graffiti + Street Art)
 *  - Location: typeahead via <datalist>
 *  - Seed data: auto-load sample entries if none in localStorage
 */

export default function App() {
  const [activeTab, setActiveTab] = useState<"submit" | "directory">("directory");
  const [entries, setEntries] = useState<ArtistEntry[]>([]);

  // Load & persist
  useEffect(() => {
    const raw = localStorage.getItem("ll_submissions");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setEntries(parsed as ArtistEntry[]);
        else setEntries(SAMPLE_ENTRIES);
      } catch (e) {
        console.error("Failed to parse saved entries", e);
        setEntries(SAMPLE_ENTRIES);
      }
    } else {
      setEntries(SAMPLE_ENTRIES);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ll_submissions", JSON.stringify(entries));
  }, [entries]);

  // Filters
  const [q, setQ] = useState("");
  const [filterArt, setFilterArt] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");

  const artTypesDynamic = useMemo(() => uniq(entries.map((e) => e.artType).filter(Boolean)), [entries]);
  const locations = useMemo(() => uniq(entries.map((e) => e.location).filter(Boolean)), [entries]);

  const filtered = useMemo(() => {
    return entries
      .filter((e) => (filterArt === "all" ? true : e.artType === filterArt))
      .filter((e) => (filterLocation === "all" ? true : e.location === filterLocation))
      .filter((e) => (q.trim() ? `${e.name} ${e.location} ${e.artType}`.toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, filterArt, filterLocation, q]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800 font-mono">
      <header className="sticky top-0 z-10 bg-neutral-50/90 backdrop-blur border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="tracking-tight text-pink-600 font-bold">Love Letter — Artists</h1>
          <nav className="flex items-center gap-2 text-sm">
            <button
              onClick={() => setActiveTab("submit")}
              className={`px-3 py-1.5 rounded border ${activeTab === "submit" ? "border-neutral-500" : "border-neutral-300 hover:bg-neutral-100"}`}
            >
              Submit
            </button>
            <button
              onClick={() => setActiveTab("directory")}
              className={`px-3 py-1.5 rounded border ${activeTab === "directory" ? "border-neutral-500" : "border-neutral-300 hover:bg-neutral-100"}`}
            >
              Directory
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === "submit" ? (
          <SubmissionForm
            onSubmit={(entry) => setEntries((prev) => [entry, ...prev])}
            knownLocations={[
              "Melbourne, Australia",
              "Sydney, Australia",
              "Brisbane, Australia",
              "Perth, Australia",
              "Adelaide, Australia",
              "Auckland, New Zealand",
              "Wellington, New Zealand",
              "London, UK",
              "Berlin, Germany",
              "Lisbon, Portugal",
              "Paris, France",
              "New York, USA",
              "Los Angeles, USA",
              ...locations,
            ]}
          />
        ) : (
          <Directory
            entries={filtered}
            q={q}
            setQ={setQ}
            artTypes={["all", ...artTypesDynamic]}
            filterArt={filterArt}
            setFilterArt={setFilterArt}
            locations={["all", ...locations]}
            filterLocation={filterLocation}
            setFilterLocation={setFilterLocation}
            onDelete={(id) => setEntries((prev) => prev.filter((e) => e.id !== id))}
            onImport={(list) => setEntries(list)}
            onExport={() => downloadJSON(entries, `loveletter-artists-${new Date().toISOString().slice(0, 10)}.json`)}
          />
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-10 text-sm text-neutral-500">
        <p>Demo stores data locally. Migrate later to Firebase/Supabase for multi-user submissions.</p>
      </footer>
    </div>
  );
}

/** Types **/
export type ArtistEntry = {
  id: string;
  name: string;
  artType: string;
  location: string;
  bio: string;
  images: string[]; // data URLs
  links: { label: string; url: string }[];
  createdAt: string; // ISO
};

type LinkField = { label: string; url: string };

/** Submission Form **/
function SubmissionForm({ onSubmit, knownLocations }: { onSubmit: (e: ArtistEntry) => void; knownLocations: string[] }) {
  const [name, setName] = useState("");
  const [artType, setArtType] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [links, setLinks] = useState<LinkField[]>([{ label: "Instagram", url: "" }]);
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const arr = Array.from(files);
    const dataUrls = await Promise.all(arr.map(fileToDataURL));
    setImages((prev) => [...prev, ...dataUrls]);
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLink(idx: number, patch: Partial<LinkField>) {
    setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLink() {
    setLinks((prev) => [...prev, { label: "Website", url: "" }]);
  }

  function removeLink(idx: number) {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !artType.trim() || !location.trim()) {
      alert("Please fill name, art type and location.");
      return;
    }
    setSaving(true);
    const entry: ArtistEntry = {
      id: crypto.randomUUID(),
      name: name.trim(),
      artType: artType.trim(),
      location: location.trim(),
      bio: bio.trim(),
      images,
      links: links.filter((l) => l.url.trim()),
      createdAt: new Date().toISOString(),
    };
    onSubmit(entry);
    setSaving(false);
    // Reset
    setName("");
    setArtType("");
    setLocation("");
    setBio("");
    setLinks([{ label: "Instagram", url: "" }]);
    setImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="grid md:grid-cols-5 gap-8">
      <div className="md:col-span-3">
        <h2 className="text-lg mb-2 text-pink-600">Submit your work</h2>
        <p className="text-sm text-neutral-600 mb-6">Required fields: Name, Art type, Location.</p>
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-sm">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-neutral-50 placeholder-neutral-400"
              placeholder="Name"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm">Type of art</label>
              <select
                value={artType}
                onChange={(e) => setArtType(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-neutral-50"
              >
                <option value="">Select an option</option>
                {ART_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm">Where you're from (City, Country)</label>
              <input
                list="ll-locations"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-neutral-50 placeholder-neutral-400"
                placeholder="City, Country"
              />
              <datalist id="ll-locations">
                {uniq(knownLocations).map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            </div>
          </div>
          <div>
            <label className="block text-sm">Artist bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-400 bg-neutral-50 placeholder-neutral-400"
              placeholder="Short bio (optional)"
            />
          </div>
          <div>
            <label className="block text-sm mb-2">Images (JPG/PNG, multiple)</label>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} />
            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 mt-3">
                {images.map((src, i) => (
                  <div key={i} className="relative group border border-neutral-300 rounded overflow-hidden">
                    <img src={src} alt="upload preview" className="w-full h-28 object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 text-xs bg-neutral-50/95 rounded px-1.5 py-0.5 border border-neutral-300 opacity-0 group-hover:opacity-100 transition"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm">Links</label>
              <button type="button" onClick={addLink} className="text-sm underline">
                + Add link
              </button>
            </div>
            {links.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2">
                <input
                  value={l.label}
                  onChange={(e) => updateLink(i, { label: e.target.value })}
                  className="col-span-4 rounded border border-neutral-300 px-3 py-2 bg-neutral-50"
                  placeholder="Label (Instagram, Website, Portfolio)"
                />
                <input
                  value={l.url}
                  onChange={(e) => updateLink(i, { url: e.target.value })}
                  className="col-span-7 rounded border border-neutral-300 px-3 py-2 bg-neutral-50"
                  placeholder="https://..."
                />
                <button type="button" onClick={() => removeLink(i)} className="col-span-1 text-sm underline">
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded border border-neutral-400 px-5 py-2.5 hover:bg-neutral-100 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Submit"}
            </button>
          </div>
        </form>
      </div>

      <aside className="md:col-span-2 bg-neutral-50 rounded border border-neutral-200 p-5 h-fit sticky top-24">
        <h3 className="mb-2 text-pink-600">What happens next?</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-neutral-600">
          <li>Your submission is stored locally in this demo.</li>
          <li>Switch to the Directory tab to see your listing.</li>
          <li>Export JSON to migrate to a database later.</li>
        </ol>
        <div className="mt-4 text-xs text-neutral-500">Tip: Keep art type consistent.</div>
      </aside>
    </section>
  );
}

/** Directory **/
function Directory(props: {
  entries: ArtistEntry[];
  q: string;
  setQ: (v: string) => void;
  artTypes: string[];
  filterArt: string;
  setFilterArt: (v: string) => void;
  locations: string[];
  filterLocation: string;
  setFilterLocation: (v: string) => void;
  onDelete: (id: string) => void;
  onImport: (list: ArtistEntry[]) => void;
  onExport: () => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  function handleImport(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (Array.isArray(data)) props.onImport(sanitize(data));
        else alert("Invalid file");
      } catch {
        alert("Could not parse JSON");
      }
    };
    reader.readAsText(file);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm">Search</label>
          <input
            value={props.q}
            onChange={(e) => props.setQ(e.target.value)}
            className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 bg-neutral-50"
            placeholder="Search by name, art type, location"
          />
        </div>
        <div>
          <label className="block text-sm">Art type</label>
          <select
            value={props.filterArt}
            onChange={(e) => props.setFilterArt(e.target.value)}
            className="mt-1 rounded border border-neutral-300 px-3 py-2 min-w-[200px] bg-neutral-50"
          >
            {props.artTypes.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "All" : t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm">Location</label>
          <select
            value={props.filterLocation}
            onChange={(e) => props.setFilterLocation(e.target.value)}
            className="mt-1 rounded border border-neutral-300 px-3 py-2 min-w-[200px] bg-neutral-50"
          >
            {props.locations.map((t) => (
              <option key={t} value={t}>
                {t === "all" ? "All" : t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => props.onExport()} className="mt-6 px-3 py-2 rounded border border-neutral-300">
            Export JSON
          </button>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => handleImport(e.target.files)}
            />
            <button onClick={() => fileRef.current?.click()} className="mt-6 px-3 py-2 rounded border border-neutral-300">
              Import JSON
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {props.entries.map((e) => (
          <ArtistCard key={e.id} entry={e} onDelete={props.onDelete} />
        ))}
        {props.entries.length === 0 && (
          <div className="col-span-full text-center text-neutral-400 py-10">No entries yet.</div>
        )}
      </div>
    </section>
  );
}

function ArtistCard({ entry, onDelete }: { entry: ArtistEntry; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded overflow-hidden">
      {entry.images?.[0] ? (
        <img src={entry.images[0]} alt={entry.name} className="w-full h-48 object-cover" />
      ) : (
        <div className="w-full h-48 bg-neutral-100 flex items-center justify-center text-neutral-400 text-sm">No image</div>
      )}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="leading-tight text-pink-600">{entry.name}</h3>
            <p className="text-sm text-neutral-600">
              {entry.artType} • {entry.location}
            </p>
          </div>
          <button onClick={() => onDelete(entry.id)} className="text-xs underline">
            Delete
          </button>
        </div>
        {entry.bio && <p className="text-sm">{entry.bio}</p>}
        <button onClick={() => setOpen(!open)} className="text-sm underline">
          {open ? "Hide details" : "View details"}
        </button>
        {open && (
          <div className="pt-2 space-y-3">
            {entry.images?.length > 1 && (
              <div className="grid grid-cols-3 gap-2">
                {entry.images.slice(1).map((src, i) => (
                  <img key={i} src={src} alt="art" className="w-full h-24 object-cover rounded" />
                ))}
              </div>
            )}
            {entry.links?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {entry.links.map((l, i) => (
                  <a
                    key={i}
                    href={normalizeUrl(l.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-100"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            )}
            <p className="text-xs text-neutral-500">Added {new Date(entry.createdAt).toLocaleDateString()}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Helpers **/
function uniq(arr: (string | undefined)[]) {
  return Array.from(new Set(arr.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function sanitize(list: any[]): ArtistEntry[] {
  return list
    .map((e) => ({
      id: String(e.id ?? crypto.randomUUID()),
      name: String(e.name ?? ""),
      artType: String(e.artType ?? ""),
      location: String(e.location ?? ""),
      bio: String(e.bio ?? ""),
      images: Array.isArray(e.images) ? e.images.filter(Boolean).map(String) : [],
      links: Array.isArray(e.links)
        ? e.links
            .filter((l: any) => l && (l.url || l.label))
            .map((l: any) => ({ label: String(l.label ?? "Link"), url: String(l.url ?? "") }))
        : [],
      createdAt: String(e.createdAt ?? new Date().toISOString()),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeUrl(url: string) {
  if (!url) return "#";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

// Well-rounded art type list (includes Graffiti + Street Art)
const ART_TYPE_OPTIONS = [
  "Painting",
  "Illustration",
  "Photography",
  "Film/Video",
  "Animation",
  "Graphic Design",
  "Typography",
  "Web/Interactive",
  "3D/CGI",
  "Sculpture",
  "Installation",
  "Performance",
  "Sound/Music",
  "DJ/Producer",
  "Fashion/Textiles",
  "Accessories/Jewellery",
  "Product/Industrial",
  "Architecture",
  "Interior",
  "Motion Design",
  "Game Art",
  "Mixed Media",
  "Collage",
  "Graffiti",
  "Street Art",
  "Zine/Publishing",
  "Curatorial",
  "Creative Direction",
];

// Sample seed entries
const SAMPLE_ENTRIES: ArtistEntry[] = [
  {
    id: "seed-1",
    name: "Ari Kim",
    artType: "Photography",
    location: "Melbourne, Australia",
    bio: "Documentary photographer exploring youth subcultures and night streets.",
    images: [
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='360'><rect width='100%' height='100%' fill='%23ddd'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='24' fill='%23777'>Photo — placeholder</text></svg>"
    ],
    links: [{ label: "Instagram", url: "instagram.com/arixphoto" }],
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-2",
    name: "Maya Lopes",
    artType: "Illustration",
    location: "Lisbon, Portugal",
    bio: "Bold linework, quiet characters, risograph textures.",
    images: [],
    links: [{ label: "Portfolio", url: "mayalopes.art" }],
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-3",
    name: "Zed K",
    artType: "Graffiti",
    location: "Berlin, Germany",
    bio: "Letterforms, chrome, rooftops — city as canvas.",
    images: [
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='360'><rect width='100%' height='100%' fill='%23eee'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='24' fill='%23999'>Graffiti — placeholder</text></svg>"
    ],
    links: [{ label: "Instagram", url: "instagram.com/zedk" }],
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-4",
    name: "Noa Singh",
    artType: "Creative Direction",
    location: "London, UK",
    bio: "Campaign concepts for indie labels and art-led brands.",
    images: [],
    links: [{ label: "Website", url: "noasingh.studio" }],
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-5",
    name: "Kōji Tanaka",
    artType: "Sound/Music",
    location: "Tokyo, Japan",
    bio: "Ambient field recordings and modular synth diaries.",
    images: [],
    links: [{ label: "Bandcamp", url: "koji.bandcamp.com" }],
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-6",
    name: "Saffron Blue",
    artType: "Street Art",
    location: "Sydney, Australia",
    bio: "Paste-ups, wheatpaste posters, ephemeral typography.",
    images: [],
    links: [{ label: "Instagram", url: "instagram.com/saffronblue" }],
    createdAt: new Date().toISOString(),
  },
];
