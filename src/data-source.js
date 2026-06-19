const SAMPLE_ITEMS = [
  {
    id: "sample-1",
    title: "Sample public record",
    subtitle: "Replace this with the assigned public data source",
    category: "Example",
    value: "Ready",
    url: "https://athenachat.bot/docs",
    updatedAt: new Date().toISOString()
  }
];

export async function searchPublicData({ query = "", limit = 12 } = {}) {
  const normalizedQuery = query.trim().toLowerCase();
  const items = SAMPLE_ITEMS.filter((item) => {
    if (!normalizedQuery) return true;
    return [item.title, item.subtitle, item.category, item.value]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  }).slice(0, limit);

  return {
    subject: "Interview topic pending",
    sourceName: "Template sample data",
    sourceUrl: "https://athenachat.bot/docs",
    query,
    fetchedAt: new Date().toISOString(),
    count: items.length,
    items
  };
}
