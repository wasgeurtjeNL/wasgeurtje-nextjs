// components/sections/NewBenefitsSection.tsx
"use client";

import React from "react";
// If you prefer Next.js <Image>, uncomment lines below and replace <img> with <Image>
// import Image from "next/image";

type Benefit = {
  label: string;
  img: string;
  webp?: string;
  alt?: string;
};

const benefits: Benefit[] = [
  {
    label: "Uitzonderlijke kwaliteit wasparfum",
    img: "https://api.wasgeurtje.nl/wp-content/uploads/2025/04/new-icon-long-lasting-scent.svg",
    alt: "Lange houdbaarheid geur",
  },
  {
    label: "Gemaakt van milieuvriendelijke en duurzame materialen",
    img: "https://api.wasgeurtje.nl/wp-content/uploads/2025/04/new-icon-eco-friendly-and-parben-free.svg",
    alt: "Milieuvriendelijk en parabeenvrij",
  },
  {
    label: "Geen microplastics",
    img: "https://api.wasgeurtje.nl/wp-content/uploads/2025/04/new-icon-microplastic-free.svg",
    alt: "Zonder microplastics",
  },
  {
    label: "Biologisch afbreekbaar",
    img: "https://api.wasgeurtje.nl/wp-content/uploads/2025/04/new-icon-biodegradable.svg",
    alt: "Biologisch afbreekbaar",
  },
  {
    label: "Flessen van gerecycled plastic",
    img: "https://api.wasgeurtje.nl/wp-content/uploads/2025/04/new-icon-recycled-plastic.png",
    webp: "https://api.wasgeurtje.nl/wp-content/uploads/2025/04/new-icon-recycled-plastic.png.webp",
    alt: "Gerecycled plastic",
  },
  {
    label: "Compact en makkelijk in gebruik",
    img: "https://api.wasgeurtje.nl/wp-content/uploads/2025/04/new-icon-compact.svg",
    alt: "Compact formaat",
  },
];

export default function NewBenefitsSection() {
  return (
    <section className="w-full bg-[#f2e5ce]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl pb-10">
          Waarom kiezen voor het Wasgeurtje Wasparfum Proefpakket?
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b, i) => (
            <div key={i} className="flex flex-col items-center text-center">
              {/* If using next/image:
              <Image src={b.webp ?? b.img} alt={b.alt ?? b.label} width={48} height={48} /> */}
              {b.webp ? (
                <picture>
                  <source type="image/webp" srcSet={b.webp} />
                  <img
                    src={b.img}
                    width={48}
                    height={48}
                    loading="lazy"
                    alt={b.alt ?? b.label}
                    className="h-12 w-12 shrink-0"
                  />
                </picture>
              ) : (
                <img
                  src={b.img}
                  width={48}
                  height={48}
                  loading="lazy"
                  alt={b.alt ?? b.label}
                  className="h-12 w-12 shrink-0"
                />
              )}

              <p className="text-sm leading-relaxed text-gray-700">{b.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
