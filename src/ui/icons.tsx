import {
  LuApple, LuBedDouble, LuCarrot, LuCookingPot, LuEye, LuFootprints, LuGlassWater, LuHeart, LuLeaf, LuMoon, LuNotebookPen,
  LuSparkles, LuSun, LuUtensils, LuWind, LuSprout, LuDroplet, LuFlower2,
} from 'react-icons/lu';

export const HABIT_ICONS: Record<string, any> = {
  glass: LuGlassWater, sun: LuSun, apple: LuApple, carrot: LuCarrot, utensils: LuUtensils, eye: LuEye, footprints: LuFootprints,
  cooking: LuCookingPot, notebook: LuNotebookPen, moon: LuMoon, bed: LuBedDouble, heart: LuHeart, leaf: LuLeaf, sparkles: LuSparkles,
  wind: LuWind, sprout: LuSprout, droplet: LuDroplet, flower: LuFlower2,
};
export const HABIT_ICON_NAMES = Object.keys(HABIT_ICONS);

export function HabitIcon({ name, size = 20 }: { name: string; size?: number }) {
  const I = HABIT_ICONS[name] ?? LuSprout;
  return <I size={size} aria-hidden />;
}
