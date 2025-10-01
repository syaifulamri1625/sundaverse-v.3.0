import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";

// --- START OF CONSOLIDATED: types.ts ---

import type { ReactNode } from 'react';

export type FeatureId = 
  'generate-script' | 'storyboard-concepts' | 'generate-shotlist' | 'generate-callsheet' | 'casting-ideas' | 'location-scouting' |
  'daily-report' | 'continuity-tracking' | 'problem-solving' |
  'editing-sequence' | 'color-grading' | 'sound-design' | 'vfx-ideas' | 'marketing-material' |
  'metadata-tagging' | 'content-summarization' |
  'idea-brainstorming' | 'feedback-generation' | 'veo-prompt-generator' | 'veo-video-generator';

export interface InputField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number';
  placeholder: string;
  required: boolean;
}

export interface FilmFeature {
  id: FeatureId;
  name: string;
  description: string;
  icon: ReactNode;
  inputs: InputField[];
  promptTemplate: (inputs: Record<string, string>) => string;
}

export interface FeatureCategory {
  name: string;
  features: FilmFeature[];
}

export interface Character {
  id: string;
  name: string;
  race: string;
  raceCustom: string;
  gender: string;
  age: string;
  outfit: string;
  hairstyle: string;
  voice: string;
  action: string;
}

export interface Dialogue {
  id: string;
  characterId: string;
  line: string;
}

export interface SceneSettings {
  environment: string;
  lighting: string;
  cameraAngle: string;
  cameraMovement: string;
  aspectRatio: string;
}

// --- END OF CONSOLIDATED: types.ts ---


// --- START OF CONSOLIDATED: services/geminiService.ts ---

let ai: GoogleGenAI | null = null;

const getApiKey = (): string => {
  const key = process.env.API_KEY;
  if (!key) {
    throw new Error("Gemini API key not found. Please set the API_KEY environment variable.");
  }
  return key;
};

const getClient = (): GoogleGenAI => {
  if (!ai) {
    const apiKey = getApiKey();
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

const generateContent = async (prompt: string): Promise<string> => {
  try {
    const client = getClient();
    const chat: Chat = client.chats.create({ model: 'gemini-2.5-flash' });
    const response: GenerateContentResponse = await chat.sendMessage({ message: prompt });
    return response.text;
  } catch (error: any) {
    console.error("Gemini API error:", error);
    let userMessage = `An unknown error occurred: ${error.message}`;
    if (error.message) {
        if (error.message.includes('API key not valid')) {
            userMessage = 'The Gemini API key is not valid. Please ensure it is set correctly as an environment variable.';
        } else if (error.message.includes('xhr error')) {
            userMessage = 'A network error occurred while communicating with the Gemini API. This might be a temporary issue with the connection or a configuration problem. Please try again later.';
        } else {
            userMessage = `Failed to generate content from Gemini API: ${error.message}`;
        }
    }
    throw new Error(userMessage);
  }
};

const generateVideo = async (prompt: string, imageBase64: string | null): Promise<string> => {
    const client = getClient();
    const apiKey = getApiKey();
    try {
        let operation = await client.models.generateVideos({
            model: 'veo-2.0-generate-001',
            prompt: prompt,
            ...(imageBase64 && {
                image: { imageBytes: imageBase64, mimeType: 'image/png' },
            }),
            config: { numberOfVideos: 1 },
        });
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await client.operations.getVideosOperation({ operation: operation });
        }
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error("Video generation completed, but no download link was found.");
        }
        const videoResponse = await fetch(`${downloadLink}&key=${apiKey}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download the generated video. Status: ${videoResponse.statusText}`);
        }
        const videoBlob = await videoResponse.blob();
        return URL.createObjectURL(videoBlob);
    } catch (error: any) {
        console.error("VEO Video Generation Error:", error);
        throw new Error(`Failed to generate video: ${error.message}`);
    }
};

// --- END OF CONSOLIDATED: services/geminiService.ts ---


// --- START OF CONSOLIDATED: components/LoadingSpinner.tsx ---

const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// --- END OF CONSOLIDATED: components/LoadingSpinner.tsx ---


// --- START OF CONSOLIDATED: components/ApiKeyModal.tsx ---

const ApiKeyModal: React.FC<{ onSave: (apiKey: string) => void; }> = ({ onSave }) => {
  const [apiKey, setApiKey] = useState('');
  const handleSave = () => {
    if (apiKey.trim()) {
      onSave(apiKey.trim());
    }
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-8 shadow-2xl w-full max-w-md border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Masukkan Gemini API Key</h2>
        <p className="text-gray-400 mb-6">
          Untuk menggunakan aplikasi ini, Anda memerlukan Gemini API Key. Kunci Anda akan disimpan di sessionStorage dan hanya akan ada selama sesi ini.
        </p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key Anda"
          className="w-full bg-gray-900 border border-gray-600 rounded-md p-3 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
        />
        <p className="text-xs text-gray-500 mt-2">
          Aplikasi ini adalah demo sisi klien. Untuk produksi, kelola kunci API di sisi server.
        </p>
        <button
          onClick={handleSave}
          className="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-md transition duration-200"
        >
          Simpan dan Lanjutkan
        </button>
      </div>
    </div>
  );
};

// --- END OF CONSOLIDATED: components/ApiKeyModal.tsx ---


// --- START OF CONSOLIDATED: components/Header.tsx ---

const Header: React.FC = () => {
    return (
        <header className="flex-shrink-0 bg-gray-900/70 backdrop-blur-sm border-b border-gray-700/50 p-4 flex items-center justify-between">
            <div className="flex items-center">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-teal-400 mr-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12,3 C8.5,7.5 8.5,12.5 12,17 C15.5,12.5 15.5,7.5 12,3 M12,17 L10,21 L14,21 L12,17" />
                </svg>
                <h1 className="text-xl font-bold text-white">SUNDAVERSE</h1>
                <span className="ml-2 text-sm text-gray-400">Jelajahi Kekayaan Budaya Sunda Melalui Kekuatan AI Kreatif</span>
            </div>
        </header>
    );
};

// --- END OF CONSOLIDATED: components/Header.tsx ---


// --- START OF CONSOLIDATED: constants.tsx ---

const Icon = ({ path }: { path: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-3">
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const FEATURES: FeatureCategory[] = [
    {
        name: "Pra-Produksi",
        features: [
            {
                id: 'generate-script',
                name: "Pembuatan Naskah",
                description: "Hasilkan naskah film dari ide, sinopsis, atau premis cerita.",
                icon: <Icon path="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />,
                inputs: [
                    { id: 'idea', label: 'Ide Cerita', type: 'textarea', placeholder: 'Seorang astronot terdampar di planet asing dan menemukan peradaban kuno...', required: true },
                    { id: 'genre', label: 'Genre', type: 'text', placeholder: 'Sci-fi, Drama', required: true },
                    { id: 'duration', label: 'Perkiraan Durasi (menit)', type: 'number', placeholder: '15', required: false },
                ],
                promptTemplate: (inputs) => `Anda adalah penulis skenario profesional. Buatlah sebuah naskah film pendek berdasarkan ide berikut: "${inputs.idea}". Naskah harus lengkap dengan format standar (Scene Heading, Action, Character, Dialogue, Parenthetical, Transition). Genre yang diinginkan adalah "${inputs.genre}". Perkiraan durasi film adalah ${inputs.duration || '15'} menit. Pastikan dialog terasa alami dan deskripsi adegan jelas.`
            },
            {
                id: 'veo-prompt-generator',
                name: "VEO Prompt Generator",
                description: "Buat prompt text-to-video VEO yang kompleks secara interaktif dan lihat hasilnya secara langsung.",
                icon: <Icon path="M4.5 12a7.5 7.5 0 0015 0m-15 0a7.5 7.5 0 1115 0m-15 0H3m18 0h-1.5m-15 0a7.5 7.5 0 1115 0m-15 0h1.5m12 0h1.5m-9-3.75l.155.291a.338.338 0 00.3.159h.69a.338.338 0 00.3-.159l.155-.291m-1.8 0l.155.291a.338.338 0 00.3.159h.69a.338.338 0 00.3-.159l.155-.291m-1.8 0a.5.5 0 01.5-.5h.8a.5.5 0 01.5.5m-1.8 0a.5.5 0 00-.5.5v.8a.5.5 0 00.5.5h.8a.5.5 0 00.5-.5v-.8a.5.5 0 00-.5-.5m-15 3.75a7.5 7.5 0 1115 0m-15 0" />,
                inputs: [],
                promptTemplate: () => ``,
            },
            {
                id: 'generate-shotlist',
                name: "Pembuatan Shot List",
                description: "Buat daftar shot yang detail berdasarkan adegan dari naskah.",
                icon: <Icon path="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.776 48.776 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z M12 15a3 3 0 100-6 3 3 0 000 6z" />,
                inputs: [
                    { id: 'scene', label: 'Deskripsi Adegan', type: 'textarea', placeholder: 'EXT. TAMAN KOTA - SORE. Budi duduk di bangku taman, membaca surat dengan ekspresi sedih. Rina mendekat dari belakang.', required: true },
                    { id: 'style', label: 'Gaya Visual', type: 'text', placeholder: 'Cinematic, handheld, warna hangat', required: false },
                ],
                promptTemplate: (inputs) => `Anda adalah seorang Director of Photography. Buatlah shot list yang detail untuk adegan berikut: "${inputs.scene}". Untuk setiap shot, tentukan: Nomor Shot, Tipe Shot (e.g., Wide Shot, Medium Close-Up), Angle (e.g., Eye Level, Low Angle), Pergerakan Kamera (e.g., Static, Pan, Dolly), Lensa (e.g., 35mm, 85mm), dan deskripsi singkat tentang apa yang terjadi dalam shot tersebut. Pertimbangkan gaya visual: "${inputs.style || 'standar sinematik'}". Sajikan dalam format tabel yang jelas.`
            },
            {
                id: 'generate-callsheet',
                name: "Pembuatan Call Sheet",
                description: "Hasilkan call sheet harian untuk kru dan pemain.",
                icon: <Icon path="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M12 12.75h.008v.008H12v-.008z" />,
                inputs: [
                    { id: 'project', label: 'Nama Proyek', type: 'text', placeholder: 'Film "Harapan"', required: true },
                    { id: 'date', label: 'Tanggal Syuting', type: 'text', placeholder: '25 Desember 2024', required: true },
                    { id: 'location', label: 'Lokasi Syuting', type: 'text', placeholder: 'Taman Suropati, Jakarta', required: true },
                    { id: 'scenes', label: 'Adegan yang Akan Diambil', type: 'textarea', placeholder: 'Scene 5: Budi bertemu Rina. Scene 8: Flashback masa kecil.', required: true },
                    { id: 'cast', label: 'Pemain yang Terlibat', type: 'textarea', placeholder: 'Budi (Aktor A), Rina (Aktris B)', required: true },
                ],
                promptTemplate: (inputs) => `Buatlah call sheet profesional untuk produksi film. Berikut adalah detailnya:
- Nama Proyek: ${inputs.project}
- Tanggal: ${inputs.date}
- Lokasi Utama: ${inputs.location}
- Adegan yang Akan Diambil: ${inputs.scenes}
- Pemain yang Terlibat (dan waktu call time mereka): ${inputs.cast}
- Kontak Penting: Produser (0812345678), Sutradara (0812345679)
- Cuaca: Perkirakan cuaca untuk lokasi dan tanggal tersebut.
- Jadwal: Buat jadwal terperinci dari kedatangan kru hingga selesai syuting.
- Catatan Tambahan: Mohon bawa properti pribadi sesuai arahan.

Sajikan dalam format call sheet yang jelas, rapi, dan mudah dibaca.`
            },
             {
                id: 'storyboard-concepts',
                name: "Konsep Storyboard",
                description: "Hasilkan deskripsi visual untuk setiap frame storyboard.",
                icon: <Icon path="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm16.5-1.5H3.75V6h16.5v12z" />,
                inputs: [
                    { id: 'scene_script', label: 'Potongan Naskah', type: 'textarea', placeholder: 'Budi berlari di tengah hujan, mengejar taksi yang melaju kencang.', required: true },
                ],
                promptTemplate: (inputs) => `Anda adalah seorang storyboard artist. Berdasarkan potongan naskah ini: "${inputs.scene_script}", berikan deskripsi visual yang detail untuk 3-5 frame storyboard kunci. Untuk setiap frame, jelaskan: Komposisi, Sudut Kamera, Ekspresi Karakter, Aksi, dan Elemen Latar yang penting.`
            },
            {
                id: 'casting-ideas',
                name: "Ide Casting",
                description: "Dapatkan rekomendasi aktor/aktris untuk karakter tertentu.",
                icon: <Icon path="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />,
                inputs: [
                    { id: 'character_desc', label: 'Deskripsi Karakter', type: 'textarea', placeholder: 'Seorang detektif tua yang lelah dengan dunia tapi memiliki insting tajam. Usia 50-60 tahun.', required: true },
                    { id: 'actor_type', label: 'Tipe Aktor (Opsional)', type: 'text', placeholder: 'Aktor Indonesia, Aktor Hollywood', required: false },
                ],
                promptTemplate: (inputs) => `Berikan 5 rekomendasi aktor (${inputs.actor_type || 'Indonesia'}) yang cocok untuk memerankan karakter dengan deskripsi berikut: "${inputs.character_desc}". Untuk setiap aktor, berikan alasan singkat mengapa mereka cocok untuk peran tersebut, sebutkan film-film relevan mereka.`
            },
            {
                id: 'location-scouting',
                name: "Ide Pencarian Lokasi",
                description: "Dapatkan ide lokasi syuting berdasarkan deskripsi adegan.",
                icon: <Icon path="M9 6.75V15m6-6v8.25m.5-10.5h-7a.5.5 0 00-.5.5v12.5a.5.5 0 00.5.5h7a.5.5 0 00.5-.5V6.25a.5.5 0 00-.5-.5z" />,
                inputs: [
                    { id: 'scene_setting', label: 'Setting Adegan', type: 'textarea', placeholder: 'Kafe terpencil dengan nuansa vintage dan jendela besar yang menghadap ke jalanan sepi.', required: true },
                    { id: 'city', label: 'Kota/Area', type: 'text', placeholder: 'Bandung, Indonesia', required: true },
                ],
                promptTemplate: (inputs) => `Saya mencari lokasi syuting di area ${inputs.city}. Berikan 5 ide tipe lokasi yang spesifik untuk adegan dengan setting berikut: "${inputs.scene_setting}". Untuk setiap ide, jelaskan suasana yang bisa didapat dan potensi tantangan logistiknya.`
            }
        ]
    },
    {
        name: "Produksi",
        features: [
            {
                id: 'veo-video-generator',
                name: "Generator Video VEO3",
                description: "Buat video dari teks atau gambar menggunakan model VEO terbaru.",
                icon: <Icon path="M15.362 5.214A8.25 8.25 0 0112 21a8.25 8.25 0 01-3.362-15.786M15.75 10.5H18v-3M12 3v18" />,
                inputs: [],
                promptTemplate: () => ``,
            },
            { id: 'daily-report', name: "Laporan Produksi Harian", description: "Buat rangkuman laporan produksi harian secara otomatis.", icon: <Icon path="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />, inputs: [], promptTemplate: (inputs) => `Buat template Laporan Produksi Harian yang siap diisi.` },
            { id: 'continuity-tracking', name: "Pelacakan Kontinuitas", description: "Bantu catat detail kontinuitas dari sebuah adegan.", icon: <Icon path="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.667 0l3.182-3.182m0-4.991v4.99" />, inputs: [], promptTemplate: (inputs) => `Berikan checklist detail kontinuitas (kostum, properti, posisi aktor) untuk adegan dialog antara dua orang di sebuah meja kafe.` },
            { id: 'problem-solving', name: "Pemecahan Masalah di Set", description: "Dapatkan solusi cepat untuk masalah umum di lokasi syuting.", icon: <Icon path="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />, inputs: [], promptTemplate: (inputs) => `Hujan tiba-tiba turun saat syuting adegan outdoor. Berikan 3 solusi kreatif untuk melanjutkan produksi tanpa kehilangan banyak waktu.` },
        ]
    },
    {
        name: "Pasca-Produksi",
        features: [
            { id: 'editing-sequence', name: "Ide Urutan Editing", description: "Dapatkan ide untuk merangkai urutan adegan agar lebih berdampak.", icon: <Icon path="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12l-3 3m0 0l-3-3m3 3V9" />, inputs: [], promptTemplate: (inputs) => `Saya punya adegan A (perkenalan tokoh), B (konflik utama muncul), dan C (flashback masa lalu tokoh). Berikan 3 alternatif urutan editing (misal: A-C-B) dan jelaskan dampak emosional yang berbeda dari setiap urutan.` },
            { id: 'color-grading', name: "Palet Color Grading", description: "Hasilkan palet warna dan moodboard untuk color grading.", icon: <Icon path="M4.098 19.902a3.75 3.75 0 005.304 0l6.402-6.402a3.75 3.75 0 00-5.304-5.304L4.098 14.6a3.75 3.75 0 000 5.304z M17.25 4.5a3.75 3.75 0 00-5.303 0l-1.03 1.03a.75.75 0 001.06 1.06l1.03-1.03a2.25 2.25 0 013.182 3.182l-1.03 1.03a.75.75 0 101.06 1.06l1.03-1.03a3.75 3.75 0 000-5.303z" />, inputs: [], promptTemplate: (inputs) => `Untuk film genre thriller psikologis yang berlatar di kota modern, berikan deskripsi moodboard untuk color grading. Sebutkan palet warna utama (misal: teal and orange), tingkat kontras, saturasi, dan referensi film yang relevan.` },
            { id: 'sound-design', name: "Konsep Desain Suara", description: "Dapatkan ide untuk elemen suara dan musik.", icon: <Icon path="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />, inputs: [], promptTemplate: (inputs) => `Buat konsep sound design untuk adegan horor di mana karakter berjalan sendirian di koridor rumah sakit tua yang gelap. Sebutkan elemen-elemen suara (ambience, foley, sound effects) yang bisa membangun ketegangan.` },
            { id: 'vfx-ideas', name: "Ide Efek Visual (VFX)", description: "Brainstorming ide efek visual untuk adegan tertentu.", icon: <Icon path="M15.362 5.214A8.25 8.25 0 0112 21a8.25 8.25 0 01-3.362-15.786" />, inputs: [], promptTemplate: (inputs) => `Dalam adegan fantasi, seorang penyihir merapal mantra. Berikan 3 ide VFX yang berbeda untuk memvisualisasikan mantra tersebut (misal: partikel energi, distorsi ruang, simbol bercahaya).` },
            { id: 'marketing-material', name: "Materi Pemasaran", description: "Hasilkan tagline, sinopsis pendek, dan ide poster.", icon: <Icon path="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />, inputs: [], promptTemplate: (inputs) => `Sebuah film bercerita tentang seorang musisi jalanan yang menemukan gitar ajaib. Buatlah 5 tagline menarik, 1 sinopsis pendek (3 kalimat), dan 3 konsep ide untuk poster filmnya.` },
        ]
    },
    {
        name: "Manajemen Aset & Kolaborasi",
        features: [
            { id: 'metadata-tagging', name: "Penandaan Metadata", description: "Hasilkan tag metadata untuk klip video.", icon: <Icon path="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M11.25 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />, inputs: [], promptTemplate: (inputs) => `Sebuah klip video menunjukkan "dua orang tertawa di pantai saat matahari terbenam". Hasilkan 10-15 tag metadata yang relevan untuk klip ini.` },
            { id: 'content-summarization', name: "Rangkuman Konten", description: "Buat rangkuman dari naskah atau transkrip yang panjang.", icon: <Icon path="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />, inputs: [], promptTemplate: (inputs) => `Saya akan memberikan naskah sepanjang 10 halaman. Tolong rangkum plot utamanya menjadi 5 poin kunci.` },
            { id: 'idea-brainstorming', name: "Brainstorming Ide", description: "Dapatkan variasi ide cerita dari satu premis.", icon: <Icon path="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75-10.5a3.75 3.75 0 017.5 0c0 1.333-.28 2.56-1.12 3.533m-5.26-3.533c-.84 1.054-1.12 2.2-1.12 3.533" />, inputs: [], promptTemplate: (inputs) => `Premis: "Sebuah jam saku bisa memutar kembali waktu 10 detik". Berikan 3 pengembangan cerita yang berbeda: satu untuk genre komedi, satu untuk thriller, dan satu untuk drama romantis.` },
            { id: 'feedback-generation', name: "Pembuatan Umpan Balik", description: "Dapatkan umpan balik konstruktif untuk potongan naskah atau adegan.", icon: <Icon path="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-3.04 8.25-6.75 8.25-1.41 0-2.734-.363-3.868-.995l-4.224 2.112a.75.75 0 01-.933-.933l2.112-4.224A8.206 8.206 0 013 12c0-4.556 3.04-8.25 6.75-8.25s6.75 3.694 6.75 8.25z" />, inputs: [], promptTemplate: (inputs) => `Saya akan memberikan sebuah adegan dialog. Berikan umpan balik konstruktif dengan fokus pada: 1. Kejelasan motivasi karakter, 2. Aliran dialog, dan 3. Potensi subteks yang bisa ditambahkan.` },
        ]
    }
];

// --- END OF CONSOLIDATED: constants.tsx ---


// --- START OF CONSOLIDATED: components/Sidebar.tsx ---

interface SidebarProps {
  activeFeatureId: FeatureId;
  onSelectFeature: (id: FeatureId) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeFeatureId, onSelectFeature }) => {
  return (
    <aside className="w-64 bg-gray-900/80 backdrop-blur-sm border-r border-gray-700/50 flex-shrink-0 overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Modul AI</h2>
      </div>
      <nav className="flex-grow">
        {FEATURES.map((category) => (
          <div key={category.name} className="py-2">
            <h3 className="px-4 mb-2 text-sm font-bold text-teal-300">{category.name}</h3>
            <ul>
              {category.features.map((feature) => (
                <li key={feature.id}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectFeature(feature.id);
                    }}
                    className={`flex items-center px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                      activeFeatureId === feature.id
                        ? 'bg-teal-600/30 text-white border-l-4 border-teal-400'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                    }`}
                  >
                    {feature.icon}
                    <span>{feature.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
};

// --- END OF CONSOLIDATED: components/Sidebar.tsx ---


// --- START OF CONSOLIDATED: components/VeoPromptGenerator.tsx ---

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

const inputClasses = "w-full bg-gray-900/70 border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition text-sm";
const labelClasses = "block text-sm font-medium text-gray-300 mb-1";
const buttonClasses = "bg-teal-600 hover:bg-teal-700 disabled:bg-teal-900/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition duration-200 text-sm";
const removeButtonClasses = "bg-red-600/80 hover:bg-red-700/80 text-white font-bold py-1 px-3 rounded-md transition duration-150 text-xs";
const addButtonClasses = "bg-teal-600/80 hover:bg-teal-700/80 text-white font-bold py-1 px-3 rounded-md transition duration-150 text-xs";

const voiceOptions = [
    'Tenang dan lembut', 'Serak', 'Berwibawa', 'Melengking', 'Monoton',
    'Bersemangat', 'Sarkastik', 'Muda', 'Tua', 'Ceria', 'Sedih',
    'Robotik', 'Bergema', 'Berbisik',
];

interface VeoPromptGeneratorProps {
  feature: FilmFeature;
}

const VeoPromptGenerator: React.FC<VeoPromptGeneratorProps> = ({ feature }) => {
    const [characters, setCharacters] = useState<Character[]>([]);
    const [dialogues, setDialogues] = useState<Dialogue[]>([]);
    const [sceneSettings, setSceneSettings] = useState<SceneSettings>({
        environment: 'a vibrant Sundanese village during a festival',
        lighting: 'warm golden hour lighting',
        cameraAngle: 'medium shot',
        cameraMovement: 'slow panning shot',
        aspectRatio: '16:9',
    });
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [copied, setCopied] = useState(false);

    const generatePrompt = useCallback(() => {
        let prompt = `A video with aspect ratio ${sceneSettings.aspectRatio}. `;
        prompt += `The scene is set in ${sceneSettings.environment}, with ${sceneSettings.lighting}. `;
        prompt += `The camera angle is a ${sceneSettings.cameraAngle}, with ${sceneSettings.cameraMovement}. `;
        if (characters.length > 0) {
            prompt += 'The scene features the following characters: ';
            const charDescriptions = characters.map(c => {
                let desc = `${c.name}, a ${c.age.toLowerCase()} ${c.gender.toLowerCase()} ${c.race === 'Lainnya' ? c.raceCustom.toLowerCase() : c.race.toLowerCase()}`;
                if (c.outfit) desc += `, wearing ${c.outfit}`;
                if (c.hairstyle) desc += `, with ${c.hairstyle}`;
                if (c.voice) desc += ` and a ${c.voice.toLowerCase()} voice`;
                if (c.action) desc += `, who is ${c.action}`;
                return desc;
            }).join('. ');
            prompt += charDescriptions + '. ';
        }
        if (dialogues.length > 0) {
            prompt += 'The dialogue is as follows: ';
            const dialogueLines = dialogues.map(d => {
                const char = characters.find(c => c.id === d.characterId);
                return char ? `${char.name} says, "${d.line}"` : '';
            }).filter(Boolean).join('. ');
            prompt += dialogueLines + '.';
        }
        return prompt.trim().replace(/\s+/g, ' ');
    }, [sceneSettings, characters, dialogues]);
    
    useEffect(() => {
        setGeneratedPrompt(generatePrompt());
    }, [sceneSettings, characters, dialogues, generatePrompt]);

    const addCharacter = () => {
        setCharacters(prev => [...prev, {
            id: generateId(), name: `Karakter ${prev.length + 1}`, race: 'Manusia', raceCustom: '', gender: 'Lainnya',
            age: 'Dewasa', outfit: 'Pakaian tradisional Sunda', hairstyle: 'rambut hitam pendek', voice: 'tenang dan lembut', action: 'tersenyum'
        }]);
    };
    const updateCharacter = (id: string, field: keyof Character, value: string) => {
        setCharacters(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };
    const removeCharacter = (id: string) => {
        setCharacters(prev => prev.filter(c => c.id !== id));
        setDialogues(prev => prev.filter(d => d.characterId !== id));
    };

    const addDialogue = () => {
        if (characters.length > 0) {
            setDialogues(prev => [...prev, { id: generateId(), characterId: characters[0].id, line: '' }]);
        }
    };
    const updateDialogue = (id: string, field: keyof Dialogue, value: string) => {
        setDialogues(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    };
    const removeDialogue = (id: string) => {
        setDialogues(prev => prev.filter(d => d.id !== id));
    };
    
    const updateSceneSetting = (field: keyof SceneSettings, value: string) => {
        setSceneSettings(prev => ({...prev, [field]: value}));
    };

    const handleCopy = () => {
        if (!generatedPrompt) return;
        navigator.clipboard.writeText(generatedPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    const getAspectRatioClass = () => {
        switch(sceneSettings.aspectRatio) {
            case '16:9': return 'aspect-video';
            case '9:16': return 'aspect-[9/16]';
            case '1:1': return 'aspect-square';
            case '4:3': return 'aspect-[4/3]';
            case '3:4': return 'aspect-[3/4]';
            default: return 'aspect-video';
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            <datalist id="voice-options">
                {voiceOptions.map(opt => <option key={opt} value={opt} />)}
            </datalist>
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">{feature.name}</h2>
                <p className="text-gray-400">{feature.description}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <div className="bg-gray-800/80 p-6 rounded-lg border border-gray-700/50">
                        <h3 className="text-xl font-semibold text-white mb-4">Pengaturan Adegan</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label htmlFor="environment" className={labelClasses}>Lingkungan</label>
                                <input type="text" id="environment" value={sceneSettings.environment} onChange={e => updateSceneSetting('environment', e.target.value)} className={inputClasses} placeholder="misal, pasar malam yang ramai"/>
                            </div>
                            <div>
                                <label htmlFor="lighting" className={labelClasses}>Pencahayaan</label>
                                <input type="text" id="lighting" value={sceneSettings.lighting} onChange={e => updateSceneSetting('lighting', e.target.value)} className={inputClasses} placeholder="misal, cahaya neon dramatis"/>
                            </div>
                            <div>
                                <label htmlFor="cameraAngle" className={labelClasses}>Sudut Kamera</label>
                                <input type="text" id="cameraAngle" value={sceneSettings.cameraAngle} onChange={e => updateSceneSetting('cameraAngle', e.target.value)} className={inputClasses} placeholder="misal, low-angle shot"/>
                            </div>
                             <div>
                                <label htmlFor="cameraMovement" className={labelClasses}>Pergerakan Kamera</label>
                                <input type="text" id="cameraMovement" value={sceneSettings.cameraMovement} onChange={e => updateSceneSetting('cameraMovement', e.target.value)} className={inputClasses} placeholder="misal, dolly zoom cepat"/>
                            </div>
                            <div>
                                <label htmlFor="aspectRatio" className={labelClasses}>Aspek Rasio</label>
                                <select id="aspectRatio" value={sceneSettings.aspectRatio} onChange={e => updateSceneSetting('aspectRatio', e.target.value)} className={inputClasses}>
                                    <option>16:9</option><option>9:16</option><option>1:1</option><option>4:3</option><option>3:4</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-800/80 p-6 rounded-lg border border-gray-700/50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-white">Karakter</h3>
                            <button onClick={addCharacter} className={addButtonClasses}>+ Tambah Karakter</button>
                        </div>
                        <div className="space-y-4">
                            {characters.map((char) => (
                                <div key={char.id} className="p-4 bg-gray-900/50 rounded-md border border-gray-700 space-y-3">
                                    <div className="flex justify-between items-start gap-2">
                                        <input type="text" value={char.name} onChange={(e) => updateCharacter(char.id, 'name', e.target.value)} className={`${inputClasses} font-bold`} placeholder="Nama Karakter"/>
                                        <button onClick={() => removeCharacter(char.id)} className={removeButtonClasses}>Hapus</button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <select value={char.race} onChange={(e) => updateCharacter(char.id, 'race', e.target.value)} className={inputClasses}><option>Manusia</option><option>Hewan</option><option>Robot</option><option>Lainnya</option></select>
                                        {char.race === 'Lainnya' && <input type="text" value={char.raceCustom} onChange={(e) => updateCharacter(char.id, 'raceCustom', e.target.value)} className={inputClasses} placeholder="Ras Kustom"/>}
                                        <select value={char.gender} onChange={(e) => updateCharacter(char.id, 'gender', e.target.value)} className={inputClasses}><option>Pria</option><option>Wanita</option><option>Lainnya</option></select>
                                        <input type="text" value={char.age} onChange={(e) => updateCharacter(char.id, 'age', e.target.value)} className={inputClasses} placeholder="Usia (misal, 30-an)"/>
                                        <input type="text" value={char.outfit} onChange={(e) => updateCharacter(char.id, 'outfit', e.target.value)} className={inputClasses} placeholder="Pakaian"/>
                                        <input type="text" value={char.hairstyle} onChange={(e) => updateCharacter(char.id, 'hairstyle', e.target.value)} className={inputClasses} placeholder="Gaya Rambut"/>
                                        <input type="text" list="voice-options" value={char.voice} onChange={(e) => updateCharacter(char.id, 'voice', e.target.value)} className={inputClasses} placeholder="Jenis Suara"/>
                                    </div>
                                    <textarea value={char.action} onChange={(e) => updateCharacter(char.id, 'action', e.target.value)} className={`${inputClasses} min-h-[40px]`} placeholder="Aksi (misal, berjalan perlahan, melihat ke langit)"/>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-gray-800/80 p-6 rounded-lg border border-gray-700/50">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-white">Dialog</h3>
                            <button onClick={addDialogue} disabled={characters.length === 0} className={`${addButtonClasses} disabled:opacity-50`}>+ Tambah Dialog</button>
                        </div>
                        <div className="space-y-3">
                            {dialogues.map((dialogue) => (
                                <div key={dialogue.id} className="flex items-center gap-2">
                                    <select value={dialogue.characterId} onChange={(e) => updateDialogue(dialogue.id, 'characterId', e.target.value)} className={`${inputClasses} w-1/3`}>
                                        {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <input type="text" value={dialogue.line} onChange={(e) => updateDialogue(dialogue.id, 'line', e.target.value)} className={`${inputClasses} w-2/3`} placeholder="Baris dialog..."/>
                                    <button onClick={() => removeDialogue(dialogue.id)} className={removeButtonClasses}>X</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div>
                    <div className="sticky top-8 space-y-6">
                         <div className="bg-gray-900/80 p-4 rounded-lg border border-gray-700/50">
                            <h3 className="text-xl font-semibold text-white mb-4">Pratinjau Adegan</h3>
                            <div className={`${getAspectRatioClass()} w-full bg-black/50 rounded-md p-4 border border-gray-600 flex flex-col justify-between relative overflow-hidden`}>
                                <div className="absolute top-2 left-2 text-xs text-white/50 bg-black/30 px-2 py-1 rounded">
                                    <p>ENV: {sceneSettings.environment}</p>
                                    <p>LIGHT: {sceneSettings.lighting}</p>
                                </div>
                                <div className="absolute top-2 right-2 text-xs text-white/50 bg-black/30 px-2 py-1 rounded text-right">
                                    <p>ANGLE: {sceneSettings.cameraAngle}</p>
                                    <p>MOVE: {sceneSettings.cameraMovement}</p>
                                </div>
                                <div className="flex-grow flex items-center justify-center gap-4 flex-wrap">
                                    {characters.map(char => (
                                        <div key={char.id} className="text-center p-2 border border-dashed border-gray-500 rounded bg-gray-800/50">
                                            <p className="font-bold text-sm text-teal-300">{char.name}</p>
                                            <p className="text-xs text-gray-400 italic">"{char.action}"</p>
                                        </div>
                                    ))}
                                </div>
                                {dialogues.length > 0 && (
                                    <div className="w-full text-center pb-2 px-8">
                                        {dialogues.slice(-2).map(d => {
                                            const char = characters.find(c => c.id === d.characterId);
                                            return (
                                                <p key={d.id} className="text-sm text-white bg-black/40 py-1 px-2 rounded-md mb-1 last:mb-0">
                                                    <span className="font-bold">{char?.name || 'Unknown'}: </span>{d.line}
                                                </p>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-gray-900/80 p-6 rounded-lg border border-gray-700/50 min-h-[150px]">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-semibold text-white">Prompt yang Dihasilkan</h3>
                                <button onClick={handleCopy} disabled={!generatedPrompt} className={`${buttonClasses} disabled:opacity-50`}>
                                    {copied ? 'Tersalin!' : 'Salin'}
                                </button>
                            </div>
                            <p className="text-gray-300 whitespace-pre-wrap font-sans text-sm">{generatedPrompt || "Isi detail di sebelah kiri untuk membuat prompt Anda secara otomatis."}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- END OF CONSOLIDATED: components/VeoPromptGenerator.tsx ---


// --- START OF CONSOLIDATED: components/VeoVideoGenerator.tsx ---

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

const loadingMessages = [
    "Membangun dunia visual Anda...", "Mengumpulkan foton dan piksel...",
    "AI sedang melukis setiap frame...", "Menyinkronkan gerakan dan emosi...",
    "Hampir selesai, menambahkan sentuhan akhir...", "Video Anda sedang dalam perjalanan!",
];

const VeoVideoGenerator: React.FC<{ feature: FilmFeature }> = ({ feature }) => {
    const [prompt, setPrompt] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [aspectRatio, setAspectRatio] = useState('16:9');
    const [enableSound, setEnableSound] = useState(true);
    const [resolution, setResolution] = useState('1080p');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0]);
    const [error, setError] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const messageIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        if (isLoading) {
            messageIntervalRef.current = window.setInterval(() => {
                setLoadingMessage(prev => {
                    const currentIndex = loadingMessages.indexOf(prev);
                    const nextIndex = (currentIndex + 1) % loadingMessages.length;
                    return loadingMessages[nextIndex];
                });
            }, 5000);
        } else if (messageIntervalRef.current) {
            clearInterval(messageIntervalRef.current);
            messageIntervalRef.current = null;
        }
        return () => {
            if (messageIntervalRef.current) clearInterval(messageIntervalRef.current);
        };
    }, [isLoading]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt) {
            setError("Prompt tidak boleh kosong.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setVideoUrl(null);
        setLoadingMessage(loadingMessages[0]);
        try {
            const imageBase64 = imageFile ? await fileToBase64(imageFile) : null;
            const generatedVideoUrl = await generateVideo(prompt, imageBase64);
            setVideoUrl(generatedVideoUrl);
        } catch (err: any) {
            setError(err.message || 'Terjadi kesalahan saat membuat video.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">{feature.name}</h2>
                <p className="text-gray-400">{feature.description}</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-gray-800/80 p-6 rounded-lg border border-gray-700/50 space-y-4">
                    <div>
                        <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-1">
                            Prompt Teks atau JSON <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            id="prompt" rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)}
                            className="w-full bg-gray-900/70 border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                            placeholder="Contoh: seekor kuda berlari di padang rumput saat matahari terbenam, gaya sinematik..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Gambar Referensi (Opsional)</label>
                        {imagePreview ? (
                            <div className="relative w-48 h-auto">
                                <img src={imagePreview} alt="Pratinjau" className="rounded-md w-full h-full object-cover" />
                                <button type="button" onClick={removeImage} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 leading-none" aria-label="Hapus gambar">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ) : (
                            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">
                                <div className="space-y-1 text-center">
                                    <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    <div className="flex text-sm text-gray-400">
                                        <label htmlFor="file-upload" className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-teal-400 hover:text-teal-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-800 focus-within:ring-teal-500">
                                            <span>Unggah file</span>
                                            <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                                        </label>
                                        <p className="pl-1">atau seret dan lepas</p>
                                    </div>
                                    <p className="text-xs text-gray-500">PNG, JPG, GIF hingga 10MB</p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                           <label htmlFor="aspectRatio" className="block text-sm font-medium text-gray-300 mb-1">Aspek Rasio</label>
                           <select id="aspectRatio" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-gray-900/70 border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition">
                               <option>16:9</option><option>9:16</option>
                           </select>
                        </div>
                         <div>
                           <label htmlFor="resolution" className="block text-sm font-medium text-gray-300 mb-1">Resolusi</label>
                           <select id="resolution" value={resolution} onChange={e => setResolution(e.target.value)} className="w-full bg-gray-900/70 border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition">
                               <option>1080p</option><option>720p</option>
                           </select>
                        </div>
                         <div>
                           <label className="block text-sm font-medium text-gray-300 mb-1">Suara</label>
                           <div className="flex items-center space-x-4 p-2 bg-gray-900/70 border border-gray-600 rounded-md">
                               <label className="flex items-center cursor-pointer"><input type="radio" name="sound" checked={enableSound} onChange={() => setEnableSound(true)} className="form-radio text-teal-500 bg-gray-700"/> <span className="ml-2">Aktif</span></label>
                               <label className="flex items-center cursor-pointer"><input type="radio" name="sound" checked={!enableSound} onChange={() => setEnableSound(false)} className="form-radio text-teal-500 bg-gray-700"/> <span className="ml-2">Mati</span></label>
                           </div>
                        </div>
                    </div>
                </div>
                <button type="submit" disabled={isLoading || !prompt} className="w-full flex justify-center items-center bg-teal-600 hover:bg-teal-700 disabled:bg-teal-900/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md transition duration-200">
                    {isLoading ? <><LoadingSpinner /> {loadingMessage}</> : 'Buat Video'}
                </button>
            </form>
            {(isLoading || error || videoUrl) && (
                <div className="mt-8">
                    <h3 className="text-xl font-semibold text-white mb-4">Hasil Video</h3>
                    <div className="bg-gray-900/80 p-6 rounded-lg border border-gray-700/50 min-h-[200px] flex justify-center items-center">
                        {isLoading && (
                            <div className="text-center">
                                <div className="flex justify-center mb-4"><LoadingSpinner /></div>
                                <p className="text-gray-300">{loadingMessage}</p>
                                <p className="text-sm text-gray-500 mt-2">Proses ini bisa memakan waktu beberapa menit. Mohon tunggu.</p>
                            </div>
                        )}
                        {error && <div className="text-red-400 whitespace-pre-wrap text-center">{error}</div>}
                        {videoUrl && (
                            <div className="w-full">
                                <video src={videoUrl} controls className="w-full rounded-md" />
                                <a
                                    href={videoUrl}
                                    download={`sundaverse_video_${Date.now()}.mp4`}
                                    className="mt-4 w-full block text-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-200"
                                >
                                    Unduh Video
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- END OF CONSOLIDATED: components/VeoVideoGenerator.tsx ---


// --- START OF CONSOLIDATED: components/MainContent.tsx ---

interface MainContentProps {
  feature: FilmFeature;
}

const MainContent: React.FC<MainContentProps> = ({ feature }) => {
  const [formState, setFormState] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormState(prevState => ({ ...prevState, [id]: value }));
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult('');
    setError('');
    try {
      const prompt = feature.promptTemplate(formState);
      const response = await generateContent(prompt);
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [feature, formState]);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (feature.id === 'veo-prompt-generator') {
    return <VeoPromptGenerator feature={feature} />;
  }
  if (feature.id === 'veo-video-generator') {
    return <VeoVideoGenerator feature={feature} />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">{feature.name}</h2>
        <p className="text-gray-400">{feature.description}</p>
      </div>
      <div className="bg-gray-800/80 p-6 rounded-lg border border-gray-700/50">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {feature.inputs.map((input) => (
              <div key={input.id}>
                <label htmlFor={input.id} className="block text-sm font-medium text-gray-300 mb-1">
                  {input.label} {input.required && <span className="text-red-400">*</span>}
                </label>
                {input.type === 'textarea' ? (
                  <textarea
                    id={input.id} rows={4}
                    className="w-full bg-gray-900/70 border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                    placeholder={input.placeholder} onChange={handleInputChange} required={input.required}
                  />
                ) : (
                  <input
                    type={input.type} id={input.id}
                    className="w-full bg-gray-900/70 border border-gray-600 rounded-md p-2 text-gray-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                    placeholder={input.placeholder} onChange={handleInputChange} required={input.required}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-6">
            <button type="submit" disabled={isLoading}
              className="w-full flex justify-center items-center bg-teal-600 hover:bg-teal-700 disabled:bg-teal-900/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition duration-200"
            >
              {isLoading ? <><LoadingSpinner /> Sedang Memproses...</> : 'Hasilkan'}
            </button>
          </div>
        </form>
      </div>
      {(isLoading || error || result) && (
        <div className="mt-8">
            <h3 className="text-xl font-semibold text-white mb-4">Hasil</h3>
            <div className="relative bg-gray-900/80 p-6 rounded-lg border border-gray-700/50 min-h-[100px]">
                {isLoading && <div className="flex justify-center items-center h-full"><LoadingSpinner /></div>}
                {error && <div className="text-red-400 whitespace-pre-wrap">{error}</div>}
                {result && (
                    <>
                        <button onClick={handleCopy} className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-bold py-1 px-2 rounded">
                            {copied ? 'Tersalin!' : 'Salin'}
                        </button>
                        <pre className="text-gray-300 whitespace-pre-wrap font-sans text-sm">{result}</pre>
                    </>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

// --- END OF CONSOLIDATED: components/MainContent.tsx ---


// --- START OF CONSOLIDATED: App.tsx ---

const App: React.FC = () => {
  const [activeFeatureId, setActiveFeatureId] = useState<FeatureId>('generate-script');
  const activeFeature = FEATURES.flatMap(category => category.features).find(f => f.id === activeFeatureId) as FilmFeature;

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200 font-sans">
      <Sidebar activeFeatureId={activeFeatureId} onSelectFeature={setActiveFeatureId} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-800/50">
           <MainContent key={activeFeature.id} feature={activeFeature} />
        </main>
      </div>
    </div>
  );
};

// --- END OF CONSOLIDATED: App.tsx ---


// --- FINAL RENDER ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
