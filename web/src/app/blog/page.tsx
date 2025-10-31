import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./blog-styling.css";

interface BlogPost {
  id: number;
  title: {
    rendered: string;
  };
  content: {
    rendered: string;
  };
  excerpt: {
    rendered: string;
  };
  slug: string;
  date: string;
  modified?: string;
  featured_image_url?: string;
  author_name?: string;
}

export const metadata: Metadata = {
  title: "Blog - Wasgeurtje",
  description: "Ontdek onze laatste tips en artikelen over wassen en geuren.",
  openGraph: {
    title: "Blog - Wasgeurtje",
    description: "Ontdek onze laatste tips en artikelen over wassen en geuren.",
    type: "website",
  },
};

// Helper function to strip HTML tags
function stripHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

// Helper function to format date
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPage() {
  let posts: BlogPost[] = [];
  let error = null;

  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      }/api/wordpress/posts?per_page=12`,
      {
        next: { revalidate: 300 }, // Revalidate every 5 minutes
        cache: 'force-cache', // Fix for Next.js 15 streaming error
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch posts");
    }

    posts = await response.json();
  } catch (err) {
    console.error("Error fetching blog posts:", err);
    error = "Er is een fout opgetreden bij het laden van de blogposts.";
  }

  return (
    <div className="blog-container">
      <div className="blog-header">
        <h1>Wasgeurtje Blog</h1>
        <p>Ontdek onze laatste tips en artikelen over wassen en geuren</p>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {!error && posts.length === 0 && (
        <div className="no-posts">
          <p>Er zijn nog geen blogposts beschikbaar.</p>
        </div>
      )}

      {!error && posts.length > 0 && (
        <div className="blog-grid">
          {posts.map((post) => (
            <article key={post.id} className="blog-card">
              <Link href={`/blog/${post.slug}`} className="blog-card-link">
                {post.featured_image_url && (
                  <div className="blog-card-image">
                    <Image
                      src={post.featured_image_url}
                      alt={stripHtml(post.title.rendered)}
                      width={600}
                      height={400}
                      className="blog-thumbnail"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                )}
                
                <div className="blog-card-content">
                  <h2
                    className="blog-card-title"
                    dangerouslySetInnerHTML={{
                      __html: post.title.rendered,
                    }}
                  />
                  
                  <div className="blog-card-meta">
                    {post.author_name && (
                      <span className="blog-author">{post.author_name}</span>
                    )}
                    <span className="blog-date">{formatDate(post.date)}</span>
                  </div>

                  <div
                    className="blog-card-excerpt"
                    dangerouslySetInnerHTML={{
                      __html: post.excerpt.rendered,
                    }}
                  />

                  <span className="read-more">Lees meer →</span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
