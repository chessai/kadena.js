import type { FC, ReactNode } from 'react';
import React from 'react';
import { codeTitle, codeWrapper } from './style.css';

interface IProp {
  children: ReactNode;
  'data-language'?: string;
}

export const TitleWrapper: FC<IProp> = ({ children, ...props }) => {
  if (props.hasOwnProperty('data-rehype-pretty-code-fragment')) {
    return (
      <div className={codeWrapper} {...props}>
        {children}
      </div>
    );
  }

  return (
    <div className={codeTitle} {...props}>
      {children} {props['data-language']}
    </div>
  );
};
