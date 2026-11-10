/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export type OwlMood = 'cheer' | 'listening' | 'thinking' | 'sad' | 'celebrate';

interface DuoOwlProps {
  mood?: OwlMood;
  className?: string;
  size?: number;
}

export const DuoOwl: React.FC<DuoOwlProps> = ({
  mood = 'thinking',
  className = '',
  size = 110,
}) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
    >
      <svg
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm transition-transform duration-300"
      >
        {/* Duo Owl Body (Duolingo Iconic Green: #58cc02 and #46a302 shadow) */}
        <ellipse cx="80" cy="85" rx="56" ry="58" fill="#46a302" />
        <ellipse cx="80" cy="82" rx="56" ry="56" fill="#58cc02" />

        {/* Belly Light Patch */}
        <path
          d="M50 82C50 66 63 56 80 56C97 56 110 66 110 82C110 102 96 116 80 116C64 116 50 102 50 82Z"
          fill="#78c800"
          opacity="0.25"
        />

        {/* Feet */}
        <ellipse cx="62" cy="140" rx="14" ry="7" fill="#ff9600" />
        <ellipse cx="98" cy="140" rx="14" ry="7" fill="#ff9600" />

        {/* Wings */}
        {mood === 'cheer' || mood === 'celebrate' ? (
          <>
            {/* Cheering wings raised high */}
            <path
              d="M26 72C18 52 28 34 38 42C48 50 42 76 34 86"
              fill="#58cc02"
              stroke="#46a302"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M134 72C142 52 132 34 122 42C112 50 118 76 126 86"
              fill="#58cc02"
              stroke="#46a302"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            {/* Normal rest wings */}
            <path
              d="M24 82C22 96 30 112 40 116C42 104 38 90 32 80C28 78 24 80 24 82Z"
              fill="#46a302"
            />
            <path
              d="M136 82C138 96 130 112 120 116C118 104 122 90 128 80C132 78 136 80 136 82Z"
              fill="#46a302"
            />
          </>
        )}

        {/* Eyebrows / Head Feathers */}
        <path
          d="M48 40C58 34 70 38 72 44"
          stroke="#46a302"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M112 40C102 34 90 38 88 44"
          stroke="#46a302"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Eyes White Base */}
        <circle cx="56" cy="68" r="22" fill="#ffffff" />
        <circle cx="104" cy="68" r="22" fill="#ffffff" />

        {/* Eye Pupils & Expressions */}
        {mood === 'cheer' || mood === 'celebrate' ? (
          <>
            {/* Happy Arch Eyes */}
            <path
              d="M44 68C44 60 52 54 62 58C68 60 68 68 68 68"
              stroke="#3c3c3c"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M92 68C92 60 100 54 110 58C116 60 116 68 116 68"
              stroke="#3c3c3c"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Cheeks blush */}
            <circle cx="40" cy="84" r="7" fill="#ff7da7" opacity="0.6" />
            <circle cx="120" cy="84" r="7" fill="#ff7da7" opacity="0.6" />
          </>
        ) : mood === 'sad' ? (
          <>
            {/* Sad downturned pupils with tear */}
            <circle cx="56" cy="72" r="10" fill="#3c3c3c" />
            <circle cx="104" cy="72" r="10" fill="#3c3c3c" />
            {/* Big Blue Tear */}
            <ellipse cx="36" cy="80" rx="4" ry="7" fill="#1cb0f6" />
          </>
        ) : mood === 'listening' ? (
          <>
            {/* Listening attentive eyes */}
            <circle cx="58" cy="68" r="11" fill="#3c3c3c" />
            <circle cx="60" cy="65" r="4" fill="#ffffff" />
            <circle cx="106" cy="68" r="11" fill="#3c3c3c" />
            <circle cx="108" cy="65" r="4" fill="#ffffff" />
            {/* Headphones */}
            <path
              d="M32 68C32 38 128 38 128 68"
              stroke="#1cb0f6"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <rect x="24" y="60" width="12" height="20" rx="5" fill="#1899d6" />
            <rect x="124" y="60" width="12" height="20" rx="5" fill="#1899d6" />
          </>
        ) : (
          <>
            {/* Standard Thinking Eyes */}
            <circle cx="58" cy="68" r="11" fill="#3c3c3c" />
            <circle cx="61" cy="65" r="4" fill="#ffffff" />
            <circle cx="102" cy="68" r="11" fill="#3c3c3c" />
            <circle cx="105" cy="65" r="4" fill="#ffffff" />
          </>
        )}

        {/* Beak */}
        {mood === 'cheer' || mood === 'celebrate' ? (
          <path
            d="M70 78C70 78 80 94 90 78C84 84 76 84 70 78Z"
            fill="#e58200"
          />
        ) : (
          <path
            d="M72 74L80 88L88 74Z"
            fill="#ff9600"
            stroke="#e58200"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}

        {/* Celebrate Party Hat */}
        {mood === 'celebrate' && (
          <path
            d="M62 30L80 2L98 30Z"
            fill="#ff4b4b"
            stroke="#ffd226"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
};
