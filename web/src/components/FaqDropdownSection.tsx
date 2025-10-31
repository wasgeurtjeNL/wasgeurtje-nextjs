// components/TestimonialsAccordion.tsx
"use client";
import { useState } from "react";

type Item = {
  id: string;
  title: string;
  content: any;
};

export default function TestimonialsAccordion() {
  // Set to true if you want only one section open at a time
  const singleOpen = false;

  const items: Item[] = [
    {
      id: "why",
      title: "Waarom klanten zweren bij dit wasparfum?",
      content: (
        <div className="space-y-5">
          <Block
            title="Een geur die blijft hangen – dagenlang, soms zelfs weken."
            body="Zelfs als je je kleding weken later uit de kast haalt, ruik je die heerlijke geur nog steeds. Klanten noemen het “de enige wasgeur die echt blijft hangen.”"
          />
          <Block
            title="Jouw geur maakt indruk – letterlijk."
            body="“Mijn collega’s herkennen dat ik er ben aan mijn geur.” – schreef een zorgmedewerker. Jouw kleding wordt jouw geurkaartje."
          />
          <Block
            title="Het hele huis ruikt heerlijk, zonder geurstokjes of sprays."
            body="Hang je was binnen te drogen en je hele verdieping vult zich met luxe frisheid. Veel klanten zijn zelfs gestopt met geurstokjes sinds ze Wasgeurtje gebruiken."
          />
          <Block
            title="Geuren roepen herinneringen op."
            body="“Ik waande me weer op huwelijksreis in Spanje.” De geuren raken iets emotioneels. Dat maakt ze niet alleen fijn, maar waardevol."
          />
          <Block
            title="Persoonlijk getest, met liefde samengesteld."
            body="Dankzij het proefpakket vinden klanten moeiteloos hun favoriete geur. “Wat de één top vindt, vindt de ander niets – dit lost dat perfect op.”"
          />
        </div>
      ),
    },
    {
      id: "luxury",
      title: "De geur van luxe – gevangen in een paar druppels",
      content: (
        <div className="space-y-5">
          <p className="text-gray-700">
            Elke druppel van ons wasparfum is gemaakt om je dagelijks leven
            bijzonder te maken. Klanten beschrijven het als een ritueel. Een
            moment voor zichzelf. Ze kijken uit naar het openen van de
            wasmachine, het aantrekken van een trui, of het openen van de
            kledingkast. Dit is meer dan een geur – dit is een gevoel van zorg
            voor jezelf en je huis.
          </p>
          <p className="text-gray-700">
            Wasgeurtje.nl is niet zomaar een webshop. Wij zijn er om jouw
            wasroutine te veranderen in een bron van comfort, herinnering en
            geluk. En ja, het gaat lang mee – een paar druppels zijn genoeg. En
            mocht er ooit iets misgaan? Onze klantenservice wordt keer op keer
            geprezen om haar snelle, persoonlijke en zorgzame aanpak.
          </p>
          <p className="text-gray-700">
            “Iedereen vraagt welk parfum ik draag – maar het is gewoon mijn
            kleding!”
          </p>
        </div>
      ),
    },
  ];

  const [openIds, setOpenIds] = useState<string[]>([]); // first open

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const isOpen = prev.includes(id);
      if (singleOpen) return isOpen ? [] : [id];
      return isOpen ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  return (
    <section className="bg-[#fef0ca] py-[100px] px-10">
      <div className="container mx-auto">
        <header className="header space-y-3 pb-5">
          <h2 className="text-2xl md:text-3xl font-semibold text-[#814e1e]">
            🌸 Elke wasbeurt wordt een beleving. Niet alleen fris – maar
            onvergetelijk.
          </h2>
          <h3 className="text-lg md:text-xl font-medium text-gray-700">
            De geur van je kleding vertelt een verhaal. Laat het het juiste
            zijn.
          </h3>
          <p className="text-gray-700">
            Met de premium wasparfums van Wasgeurtje.nl verander je je routine
            in een moment van pure luxe, herinneringen en complimenten. Eén
            dopje is genoeg om niet alleen je kleding, maar je hele huis en
            stemming te veranderen. Daarom kiezen duizenden vrouwen elke maand
            voor deze geurbeleving.
          </p>
        </header>

        <div className="line-div h-px w-full bg-[#d6ad61]" />

        <div className="testimonials-items divide-y divide-[#d6ad61]">
          {items.map((item) => {
            const isOpen = openIds.includes(item.id);
            return (
              <section key={item.id} className="testimonials-item">
                <h4>
                  <button
                    type="button"
                    className="testimonials-item-tab flex w-full items-center justify-between gap-3 py-4 text-left text-black text-2xl"
                    aria-expanded={isOpen}
                    aria-controls={`panel-${item.id}`}
                    onClick={() => toggle(item.id)}>
                    <span className="font-medium">{item.title}</span>
                    <Chevron isOpen={isOpen} />
                  </button>
                </h4>

                <div
                  id={`panel-${item.id}`}
                  role="region"
                  aria-labelledby={`button-${item.id}`}
                  className={`grid overflow-hidden transition-all duration-300 ease-in-out text-black ${
                    isOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}>
                  <div className="min-h-0">
                    <div className="testimonials-item-content px-4 pb-6 pt-0">
                      {item.content}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="line-div h-px w-full bg-[#d6ad61]" />

        <footer className="footer space-y-2 p-5 mt-5 bg-slate-50 rounded">
          <h3 className="text-xl font-semibold text-black">
            🛒 Klaar om van jouw wasdag je favoriete moment te maken?
          </h3>
          <p className="text-gray-700">
            Bestel vandaag nog jouw geurbeleving. Kies een proefpakket of direct
            jouw favoriet.
          </p>
        </footer>
      </div>
    </section>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div className="testimonials-subitems">
      <div className="testimonials-subitems-title font-semibold">{title}</div>
      <div className="testimonials-subitems-content text-gray-700">{body}</div>
    </div>
  );
}

function Chevron({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`h-5 w-5 transform transition-transform duration-300 ${
        isOpen ? "rotate-180" : "rotate-0"
      }`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.207l3.71-2.977a.75.75 0 111.06 1.06l-4.24 3.4a.75.75 0 01-.94 0l-4.24-3.4a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
