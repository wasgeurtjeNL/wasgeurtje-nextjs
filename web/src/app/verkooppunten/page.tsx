import { Metadata } from "next";
import TextContent from "@/components/sections/TextContent";
import { fetchPage, extractSEOData } from "@/utils/wordpress-api";

// Generate metadata for SEO
export async function generateMetadata(): Promise<Metadata> {
  try {
    const page = await fetchPage("verkooppunten");
    const seo = extractSEOData(page);

    return {
      title: seo.title || "Verkooppunten - Wasgeurtje",
      description: seo.description || "Ontdek waar je Wasgeurtje producten kunt kopen in Nederland en België",
      keywords: seo.keywords,
      openGraph: {
        title: seo.ogTitle,
        description: seo.ogDescription,
        url: seo.ogUrl,
        siteName: seo.ogSiteName,
        locale: seo.ogLocale,
        type: seo.ogType as any,
      },
      twitter: {
        card: seo.twitterCard as any,
        title: seo.twitterTitle,
        description: seo.twitterDescription,
        site: seo.twitterSite,
      },
      alternates: {
        canonical: seo.canonical,
      },
    };
  } catch (error) {
    return {
      title: "Verkooppunten - Wasgeurtje",
      description: "Ontdek waar je Wasgeurtje producten kunt kopen",
    };
  }
}

// Lijst van verkooppunten (deze zou je ook kunnen ophalen uit WordPress/database)
const verkooppunten = [
  {
    name: "Etos",
    description: "Diverse Etos vestigingen in Nederland verkopen Wasgeurtje producten",
    type: "Drogisterij",
    icon: "🏪",
  },
  {
    name: "Kruidvat",
    description: "Beschikbaar bij geselecteerde Kruidvat winkels",
    type: "Drogisterij",
    icon: "🏪",
  },
  {
    name: "Online - Wasgeurtje.nl",
    description: "Bestel direct online met gratis verzending vanaf €29",
    type: "Webshop",
    icon: "🌐",
  },
];

export default async function VerkooppuntenPage() {
  try {
    // Fetch page data from WordPress
    const page = await fetchPage("verkooppunten");

    if (!page) {
      return (
        <main className="min-h-screen bg-[#F8F6F0]">
          <div className="container mx-auto px-4 py-16">
            <h1 className="text-4xl font-bold text-center">
              Verkooppunten - Pagina niet gevonden
            </h1>
          </div>
        </main>
      );
    }

    // Extract ACF page_builder sections
    const sections = page.acf?.page_builder || [];

    return (
      <main className="min-h-screen bg-[#F8F6F0]">
        {/* Page Header */}
        <section className="relative py-20 bg-gradient-to-br from-[#F8F6F0] to-[#e9c356]/10 min-h-[220px] md:min-h-[400px] flex items-center">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl md:text-5xl font-bold text-[#333333] text-center mb-4">
              Verkooppunten
            </h1>
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="h-[2px] w-20 bg-gradient-to-r from-transparent to-[#e9c356] animate-pulse"></div>
              <div className="w-2 h-2 bg-[#e9c356] rounded-full animate-ping"></div>
              <div className="h-[2px] w-20 bg-gradient-to-l from-transparent to-[#e9c356] animate-pulse"></div>
            </div>
            <p className="text-center text-[#814E1E] max-w-3xl mx-auto text-lg">
              Ontdek waar je onze heerlijke wasgeurtjes kunt kopen
            </p>
          </div>
        </section>

        {/* Render ACF Page Builder Sections */}
        {sections.map((section: any, index: number) => {
          const layout = section.acf_fc_layout;

          switch (layout) {
            case "text_content":
              return (
                <TextContent
                  key={`text-${index}`}
                  title={section.title}
                  content={section.content?.replace('[wpsl]', '')} // Remove WordPress shortcode
                  backgroundColor={section.background_color || "#FFFFFF"}
                  textColor={section.text_color || "#333333"}
                  backgroundImage={section.background?.url}
                  minHeight={section.min_height}
                  overlay={section.ovelay}
                />
              );

            default:
              console.warn(`Unknown layout type: ${layout}`);
              return null;
          }
        })}

        {/* Verkooppunten Grid */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-[#333333]">
              Onze Verkooppunten
            </h2>
            <div className="flex items-center justify-center gap-2 mb-12">
              <div className="h-[2px] w-16 bg-gradient-to-r from-transparent to-[#e9c356]"></div>
              <div className="w-2 h-2 bg-[#e9c356] rounded-full"></div>
              <div className="h-[2px] w-16 bg-gradient-to-l from-transparent to-[#e9c356]"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              {verkooppunten.map((punt, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-[#F8F6F0] to-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 border-[#e9c356]/20"
                >
                  <div className="text-5xl mb-4 text-center">{punt.icon}</div>
                  <h3 className="text-2xl font-bold text-[#333333] mb-2 text-center">
                    {punt.name}
                  </h3>
                  <p className="text-sm text-[#e9c356] font-semibold mb-3 text-center uppercase tracking-wide">
                    {punt.type}
                  </p>
                  <p className="text-[#814E1E] text-center leading-relaxed">
                    {punt.description}
                  </p>
                </div>
              ))}
            </div>

            {/* CTA Section */}
            <div className="bg-gradient-to-br from-[#e9c356] to-[#d6ad61] rounded-2xl shadow-xl p-8 md:p-12 text-center">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Wil je ook Wasgeurtje verkopen in jouw winkel?
              </h3>
              <p className="text-white/90 mb-6 max-w-2xl mx-auto">
                Sluit je aan bij ons groeiende netwerk van retailers en bied jouw klanten de beste wasparfums aan. 
                Eenvoudig aanmelden en snel aan de slag!
              </p>
              <a
                href="/retail"
                className="inline-block bg-white text-[#d6ad61] font-bold px-8 py-4 rounded-full hover:bg-gray-100 transition-colors duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Word Retailer →
              </a>
            </div>

            {/* Info Section */}
            <div className="mt-12 bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg">
              <div className="flex items-start">
                <div className="text-3xl mr-4">ℹ️</div>
                <div>
                  <h4 className="font-bold text-blue-900 mb-2">
                    Zoek je een specifieke winkel?
                  </h4>
                  <p className="text-blue-800">
                    De beschikbaarheid kan per vestiging verschillen. We raden aan om vooraf
                    telefonisch contact op te nemen met de winkel om te controleren of Wasgeurtje
                    producten op voorraad zijn. Of bestel direct online via onze webshop met
                    <strong> gratis verzending vanaf €29</strong>!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    console.error("Error loading verkooppunten page:", error);
    return (
      <main className="min-h-screen bg-[#F8F6F0]">
        <div className="container mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold text-center text-red-600">
            Er is een fout opgetreden bij het laden van de pagina
          </h1>
        </div>
      </main>
    );
  }
}

