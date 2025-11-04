import { Metadata } from "next";
import TextBox from "@/components/sections/TextBox";
import ImageTextBlock from "@/components/sections/ImageTextBlock";
import { fetchPage, extractSEOData } from "@/utils/wordpress-api";

// Generate metadata for SEO
export async function generateMetadata(): Promise<Metadata> {
  try {
    const page = await fetchPage("verzenden-retourneren");
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
      title: "Verzenden & Retourneren - Wasgeurtje",
      description: "Informatie over verzending en retourneren bij Wasgeurtje",
    };
  }
}

export default async function VerzendenRetournerenPage() {
  try {
    // Fetch page data from WordPress
    const page = await fetchPage("verzenden-retourneren");

    if (!page) {
      return (
        <main className="min-h-screen bg-[#F8F6F0]">
          <div className="container mx-auto px-4 py-16">
            <h1 className="text-4xl font-bold text-center">
              Verzenden & Retourneren - Pagina niet gevonden
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
        <section className="relative py-20 bg-gradient-to-br from-[#F8F6F0] to-[#e9c356]/10 min-h-[220px] md:min-h-[300px] flex items-center">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl md:text-5xl font-bold text-[#333333] text-center mb-4">
              {page.title?.rendered?.replace(/&#038;/g, "&") || "Verzenden & Retourneren"}
            </h1>
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="h-[2px] w-20 bg-gradient-to-r from-transparent to-[#e9c356] animate-pulse"></div>
              <div className="w-2 h-2 bg-[#e9c356] rounded-full animate-ping"></div>
              <div className="h-[2px] w-20 bg-gradient-to-l from-transparent to-[#e9c356] animate-pulse"></div>
            </div>
            <p className="text-center text-[#814E1E] max-w-3xl mx-auto text-lg">
              Alles wat je moet weten over verzending en retourneren
            </p>
          </div>
        </section>

        {/* Render ACF Page Builder Sections */}
        {sections.map((section: any, index: number) => {
          const layout = section.acf_fc_layout;

          switch (layout) {
            case "text_box":
              return (
                <TextBox
                  key={`textbox-${index}`}
                  title={section.title}
                  content={section.content}
                  boxes={section.boxes || []}
                  backgroundColor={section.background_color}
                  textColor={section.text_color}
                  alignment={section.alignment || "center"}
                />
              );

            case "image_text_block":
              return (
                <ImageTextBlock
                  key={`image-text-${index}`}
                  title={section.title}
                  content={section.content}
                  image={section.image}
                  list={section.list}
                  extraContent={section.extra_content}
                  imagePosition={section.image_position || "left"}
                  backgroundColor={section.background_color}
                  textColor={section.text_color}
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
    console.error("Error loading verzenden-retourneren page:", error);
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

