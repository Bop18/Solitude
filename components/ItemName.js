import { QUALITY, itemLink } from '@/lib/wow';

// Item name in its quality colour, linking out to Wowhead (or the saved link).
export default function ItemName({ item }) {
  const color = QUALITY[item?.quality]?.color ?? QUALITY.rare.color;
  return (
    <a href={itemLink(item)} target="_blank" rel="noreferrer" style={{ color, fontWeight: 600 }}>
      [{item?.name ?? item?.item_name}]
    </a>
  );
}
