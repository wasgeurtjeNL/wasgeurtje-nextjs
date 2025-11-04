import { Metadata } from "next";
import TextContent from "@/components/sections/TextContent";
import { fetchPage, extractSEOData } from "@/utils/wordpress-api";

// Generate metadata for SEO
export async function generateMetadata(): Promise<Metadata> {
  try {
    const page = await fetchPage("ons-verhaal");
    const seo = extractSEOData(page);

    return {
      title: seo.title,
      description: seo.description,
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
      title: "Ons Verhaal - Wasgeurtje",
      description: "Ontdek het inspirerende verhaal van Wasgeurtje.nl",
    };
  }
}

export default async function OnsVerhaalPage() {
  try {
    // Fetch ons-verhaal page data from WordPress
    const page = await fetchPage("ons-verhaal");

    if (!page) {
      return (
        <main className="min-h-screen bg-[#F8F6F0]">
          <div className="container mx-auto px-4 py-16">
            <h1 className="text-4xl font-bold text-center">
              Ons Verhaal - Pagina niet gevonden
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
              {page.title?.rendered || "Ons Verhaal"}
            </h1>
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="h-[2px] w-20 bg-gradient-to-r from-transparent to-[#e9c356] animate-pulse"></div>
              <div className="w-2 h-2 bg-[#e9c356] rounded-full animate-ping"></div>
              <div className="h-[2px] w-20 bg-gradient-to-l from-transparent to-[#e9c356] animate-pulse"></div>
            </div>
            <p className="text-center text-[#814E1E] max-w-3xl mx-auto text-lg">
              Ontdek het inspirerende verhaal van Wasgeurtje.nl, begonnen in 2020
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
                  content={section.content}
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
      </main>
    );
  } catch (error) {
    console.error("Error loading ons-verhaal page:", error);
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

