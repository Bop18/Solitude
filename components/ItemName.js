import { QUALITY, itemLink } from '@/lib/wow';

// "medium" is 36px, so icons stay sharp when shown at 18–26px
const ICON_URL = (icon) => `https://wow.zamimg.com/images/wow/icons/medium/${icon}.jpg`;

// Item icon + name in its quality colour, linking to Wowhead (hover shows the full tooltip).
// plain: no link (for use inside buttons/menus).
export default function ItemName({ item, plain = false }) {
  const color = QUALITY[item?.quality]?.color ?? QUALITY.common.color;
  const name = `[${item?.name ?? item?.item_name}]`;
  const icon = item?.icon ? (
    <img
      src={ICON_URL(item.icon)}
      alt=""
      width={18}
      height={18}
      loading="lazy"
      className="item-icon"
      style={{ borderColor: color }}
    />
  ) : null;

  const content = <>{icon}<span>{name}</span></>;
  if (plain) return <span className="item-name" style={{ color }}>{content}</span>;
  return (
    <a href={itemLink(item)} target="_blank" rel="noreferrer" className="item-name" style={{ color }} data-wh-rename-link="false" data-wh-icon-added="true">
      {content}
    </a>
  );
}
