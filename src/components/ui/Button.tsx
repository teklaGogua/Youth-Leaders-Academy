import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.scss';
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'accent' };
export default function Button({ variant = 'primary', className = '', ...props }: Props) { return <button className={`${styles.button} ${styles[variant]} ${className}`} {...props} />; }
