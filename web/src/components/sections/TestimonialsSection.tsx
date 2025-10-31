"use client";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay } from "swiper/modules";
import "swiper/css";

export default function TestimonialsSection() {
  const testimonials = [
    {
      text: "Heerlijke geuren die lang blijven hangen. De verzending was snel en het product was prachtig verpakt!",
      author: "- Maria K.",
    },
    {
      text: "Eindelijk een wasparfum dat niet te overheersend is. Perfect voor mijn gevoelige huid!",
      author: "- Jan V.",
    },
    {
      text: "Geweldige service en snelle levering. Ik bestel hier zeker weer!",
      author: "- Sophie T.",
    },
  ];

  const showLoop = testimonials.length > 1;

  return (
    <div className="bg-gradient-to-br from-white via-[#FFFDF8] to-[#FFF7EC] py-10">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-semibold text-center mb-10 text-gray-800">
          Wat klanten zeggen
        </h2>

        <div className="block lg:hidden">
          <div className="overflow-hidden">
            <Swiper
              modules={[Autoplay]}
              loop={showLoop}
              autoplay={{ delay: 3000, disableOnInteraction: false }}
              speed={600}
              spaceBetween={16}
              slidesPerView={1}
              centeredSlides={false}
              observeParents
              observer
              style={{ WebkitOverflowScrolling: "touch" }}
              breakpoints={{
                640: { slidesPerView: 1.2 },
                768: { slidesPerView: 1.6 },
              }}
              className="h-auto">
              {testimonials.map((t, i) => (
                <SwiperSlide key={i} className="!h-auto">
                  <TestimonialCard t={t} />
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>

        <div className="hidden lg:flex justify-center gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="w-full max-w-sm">
              <TestimonialCard t={t} />
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        .swiper,
        .swiper-wrapper,
        .swiper-slide {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
          will-change: transform;
        }

        .swiper {
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}

function TestimonialCard({ t }: any) {
  return (
    <div className="px-2 sm:px-3 h-full">
      <div className="flex flex-col justify-between bg-[#F4F2EB] p-6 rounded-2xl w-full min-h-[220px] shadow-sm">
        <div>
          <div className="flex flex-wrap mb-3 justify-center sm:justify-start">
            {[...Array(5)].map((_, s) => (
              <svg
                key={s}
                className="w-5 h-5 text-yellow-400 fill-current"
                viewBox="0 0 20 20"
                aria-hidden="true">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <p className="text-gray-700 text-[15px] leading-relaxed italic mb-4 text-center sm:text-left">
            "{t.text}"
          </p>
        </div>
        <p className="text-sm font-semibold text-gray-800 text-center sm:text-right">
          {t.author}
        </p>
      </div>
    </div>
  );
}
