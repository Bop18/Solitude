import { QUALITY, itemLink } from '@/lib/wow';

// Item name in its quality colour, linking to Wowhead (hover shows the full tooltip).
// plain: just the coloured name, no link (for use inside buttons/menus).
export default function ItemName({ item, plain = false }) {
  const color = QUALITY[item?.quality]?.color ?? QUALITY.common.color;
  const name = `[${item?.name ?? item?.item_name}]`;
  if (plain) return <span style={{ color, fontWeight: 600 }}>{name}</span>;
  return (
    <a href={itemLink(item)} target="_blank" rel="noreferrer" style={{ color, fontWeight: 600 }} data-wh-rename-link="false">
      {name}
    </a>
  );
}
