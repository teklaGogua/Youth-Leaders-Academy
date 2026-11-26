import styles from './AcademyLogo.module.scss';

type AcademyLogoProps = {
  variant?: 'compact' | 'hero';
};

export default function AcademyLogo({ variant = 'compact' }: AcademyLogoProps) {
  const className = variant === 'hero' ? styles.hero : styles.compact;

  return (
    <img
      className={className}
      src="/academy-emblem.png"
      alt="ახალგაზრდა ლიდერთა აკადემიის ემბლემა"
      decoding="async"
    />
  );
}
