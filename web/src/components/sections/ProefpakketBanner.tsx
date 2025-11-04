import React from "react";

const ProefpakketBanner: React.FC = () => {
  return (
    <section className="parallax bg-cover bg-bottom  sm:bg-center  text-white text-center pt-52 pb-6 px-6 md:py-28 md:px-20">
      {/* Inline responsive background images */}
      <style>{`
        section.parallax {
          background-image: url("https://api.wasgeurtje.nl/wp-content/uploads/2025/04/parallax-bg-mobile.webp");
        }

        @media (min-width: 768px) {
          section.parallax {
            background-image: url("https://api.wasgeurtje.nl/wp-content/uploads/2025/04/parallax-bg-desktop-scaled.webp");
            background-repeat: no-repeat;
            background-size: cover;
            background-position: center;
          }
        }
      `}</style>

      {/* Content */}
      <div
        className="
          parallax-container 
          flex flex-col 
          items-center justify-end text-center
          md:space-y-6
          space-y-4  
          w-[90%]
          md:static md:translate-x-0 md:items-start md:justify-center md:text-left
        "
      >
        {/* Mobile text (with proper line breaks) */}
        <h2 className="block text-[32px] font-semibold text-[#212529] md:hidden font-eb-garamond leading-tight">
          Ervaar <span className="text-[#d6ad61]">luxe</span> en{" "}
          <span className="text-[#d6ad61]">duurzaamheid</span>
          <br /> bij elke wasbeurt
        </h2>

        {/* Desktop text (with <br />) */}
        <h2 className="hidden md:block text-3xl md:text-[56px] font-semibold leading-snug text-[#212529] text-left font-eb-garamond">
          Ervaar <span className="text-[#d6ad61]">luxe</span> en
          <br />
          <span className="text-[#d6ad61]">duurzaamheid</span> bij elke
          <br /> wasbeurt
        </h2>

        {/* CTA button */}
        <div className="bg-gradient-to-l from-[#d6ad61] to-[#fcce4e] rounded w-full md:w-auto">
          <a
            href="#try-now"
            className="block text-[#212529] uppercase py-3 px-8 shadow-md w-full text-center"
          >
            Probeer het nu
          </a>
        </div>

        {/* Shipping info */}
        <div className="free-shipping flex items-center justify-center gap-3 md:mt-2 mt-1 text-[#212529]">
          <img
            src="https://api.wasgeurtje.nl/wp-content/uploads/2025/04/try-now-shipping-icon.svg"
            alt="Try Now Free Shipping Icon"
            className="w-7 h-7"
          />
          <div className="text-lg">Vandaag voor 23:59 besteld, is zelfde dag verzonden  </div>
        </div>
      </div>
    </section>
  );
};

export default ProefpakketBanner;
