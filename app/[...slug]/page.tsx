import NavyApp from "@/components/NavyApp";
export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <NavyApp path={`/${slug.join("/")}`} />;
}
