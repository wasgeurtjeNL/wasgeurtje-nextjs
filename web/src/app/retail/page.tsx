import { Metadata } from "next";
import TextContent from "@/components/sections/TextContent";
import ContactSection from "@/components/sections/ContactSection";
import { fetchPage, extractSEOData } from "@/utils/wordpress-api";

// Force this page to be dynamic to prevent build timeout  
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = false; // Disable ISR completely for this page

// Generate metadata for SEO
export async function generateMetadata(): Promise<Metadata> {
  try {
    const page = await fetchPage("retail");
    const seo = extractSEOData(page);

    return {
      title: seo.title,
      description: seo.description || "Word retailer van Wasgeurtje en verkoop onze premium wasparfums",
      keywords: seo.keywords,
      openGraph: {
        title: seo.ogTitle,
        description: seo.ogDescription,
        url: seo.ogUrl,
        siteName: seo.ogSiteName,
        locale: seo.ogLocale,
        type: seo.ogType as any,
        images: seo.ogImage ? [{ url: seo.ogImage }] : [],
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
      title: "Retail - Wasgeurtje",
      description: "Word retailer van Wasgeurtje",
    };
  }
}

export default async function RetailPage() {
  try {
    // Fetch retail page data from WordPress
    const page = await fetchPage("retail");

    if (!page) {
      return (
        <main className="min-h-screen bg-[#F8F6F0]">
          <div className="container mx-auto px-4 py-16">
            <h1 className="text-4xl font-bold text-center">
              Retail - Pagina niet gevonden
            </h1>
          </div>
        </main>
      );
    }

    // Extract ACF page_builder sections
    const sections = page.acf?.page_builder || [];

    return (
      <main className="min-h-screen bg-[#F8F6F0]">
        {/* Page Header with Featured Image */}
        <section 
          className="relative py-20 bg-gradient-to-br from-[#F8F6F0] to-[#e9c356]/10 min-h-[220px] md:min-h-[400px] flex items-center bg-cover bg-center"
          style={{
            backgroundImage: page.acf?.retail_full_title ? 'url(https://api.wasgeurtje.nl/wp-content/uploads/2023/12/bg-h.jpg)' : undefined,
            backgroundBlendMode: 'overlay',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/20"></div>
          <div className="container mx-auto px-4 relative z-10">
            <h1 className="text-3xl md:text-5xl font-bold text-white text-center mb-4 drop-shadow-lg">
              {page.acf?.retail_full_title || page.title?.rendered || "Retail"}
            </h1>
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="h-[2px] w-20 bg-gradient-to-r from-transparent to-white/80"></div>
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <div className="h-[2px] w-20 bg-gradient-to-l from-transparent to-white/80"></div>
            </div>
            {page.acf?.retail_full_desc && (
              <div 
                className="text-center text-white/95 max-w-3xl mx-auto text-lg drop-shadow"
                dangerouslySetInnerHTML={{ __html: page.acf.retail_full_desc }}
              />
            )}
          </div>
        </section>

        {/* Render ACF Page Builder Sections */}
        {sections.map((section: any, index: number) => {
          const layout = section.acf_fc_layout;

          switch (layout) {
            case "text_content":
              // Remove WordPress shortcodes
              const cleanContent = section.content
                ?.replace(/\[wasgeurtje_b2b_page\]/g, '')
                ?.replace(/\[wpsl\]/g, '');

              return (
                <TextContent
                  key={`text-${index}`}
                  title={section.title}
                  content={cleanContent}
                  backgroundColor={section.background_color || "#FFFFFF"}
                  textColor={section.text_color || "#333333"}
                  backgroundImage={section.background?.url}
                  minHeight={section.min_height}
                  overlay={section.ovelay}
                />
              );

            case "contact":
              return (
                <ContactSection
                  key={`contact-${index}`}
                  image={section.map?.url}
                  googleMap={section.google_map}
                  contactFormShortcode={section.contact_from_shortcode}
                />
              );

            default:
              console.warn(`Unknown layout type: ${layout}`);
              return null;
          }
        })}

        {/* Benefits of Becoming a Retailer */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-[#333333]">
              Waarom Wasgeurtje verkopen?
            </h2>
            <div className="flex items-center justify-center gap-2 mb-12">
              <div className="h-[2px] w-16 bg-gradient-to-r from-transparent to-[#e9c356]"></div>
              <div className="w-2 h-2 bg-[#e9c356] rounded-full"></div>
              <div className="h-[2px] w-16 bg-gradient-to-l from-transparent to-[#e9c356]"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6">
                <div className="text-5xl mb-4">🎯</div>
                <h3 className="text-xl font-bold mb-3 text-[#333333]">Premium Marge</h3>
                <p className="text-[#814E1E]">
                  Aantrekkelijke marges voor retailers met exclusieve producten
                </p>
              </div>
              <div className="text-center p-6">
                <div className="text-5xl mb-4">📦</div>
                <h3 className="text-xl font-bold mb-3 text-[#333333]">Snelle Levering</h3>
                <p className="text-[#814E1E]">
                  Betrouwbare voorraad en snelle aanvulling van producten
                </p>
              </div>
              <div className="text-center p-6">
                <div className="text-5xl mb-4">💼</div>
                <h3 className="text-xl font-bold mb-3 text-[#333333]">Groeiend Merk</h3>
                <p className="text-[#814E1E]">
                  Sluit je aan bij 300.000+ tevreden huishoudens
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    console.error("Error loading retail page:", error);
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

