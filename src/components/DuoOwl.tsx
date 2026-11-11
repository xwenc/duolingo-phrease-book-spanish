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
  const happy = mood === 'cheer' || mood === 'celebrate';
  const label = happy ? '猫头鹰开心庆祝' : mood === 'sad' ? '猫头鹰难过流泪' : mood === 'listening' ? '猫头鹰认真聆听' : '猫头鹰等待作答';
  return (
    <div
      role="img"
      aria-label={label}
      data-mood={mood}
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center shrink-0 ${happy ? 'owl-happy' : mood === 'sad' ? 'owl-sad' : ''} ${className}`}
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
        {happy ? (
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
              d={mood === 'sad' ? "M27 88C21 103 27 121 37 127C42 112 36 96 32 88Z" : "M24 82C22 96 30 112 40 116C42 104 38 90 32 80C28 78 24 80 24 82Z"}
              fill="#46a302"
            />
            <path
              d={mood === 'sad' ? "M133 88C139 103 133 121 123 127C118 112 124 96 128 88Z" : "M136 82C138 96 130 112 120 116C118 104 122 90 128 80C132 78 136 80 136 82Z"}
              fill="#46a302"
            />
          </>
        )}

        {/* Eyebrows / Head Feathers */}
        <path
          d={mood === 'sad' ? "M46 48Q59 49 70 39" : happy ? "M46 40Q58 28 72 38" : "M48 40C58 34 70 38 72 44"}
          stroke="#46a302"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d={mood === 'sad' ? "M90 39Q101 49 114 48" : happy ? "M88 38Q102 28 114 40" : "M112 40C102 34 90 38 88 44"}
          stroke="#46a302"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Eyes White Base */}
        <circle cx="56" cy="68" r="22" fill="#ffffff" />
        <circle cx="104" cy="68" r="22" fill="#ffffff" />

        {/* Eye Pupils & Expressions */}
        {happy ? (
          <>
            {/* Happy Arch Eyes */}
            <path
              d="M44 68Q56 48 68 68"
              stroke="#3c3c3c"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M92 68Q104 48 116 68"
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
            {/* Drooping eyelids and lowered pupils make sadness readable at small sizes. */}
            <path d="M35 61Q56 47 77 63Q56 69 35 61Z" fill="#58cc02" />
            <path d="M83 63Q104 47 125 61Q104 69 83 63Z" fill="#58cc02" />
            <circle cx="56" cy="72" r="10" fill="#3c3c3c" />
            <circle cx="104" cy="72" r="10" fill="#3c3c3c" />
            {/* Big Blue Tear */}
            <path className="owl-tear" d="M36 77C36 77 29 87 29 91A7 7 0 0 0 43 91C43 87 36 77 36 77Z" fill="#1cb0f6" /><circle cx="34" cy="90" r="2" fill="#8de5ff" />
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
        {happy ? (
          <>
            <path d="M67 78Q80 72 93 78Q91 100 80 101Q69 100 67 78Z" fill="#ff9600" stroke="#e58200" strokeWidth="2" />
            <path d="M71 82Q80 86 89 82Q86 94 80 94Q74 94 71 82Z" fill="#823700" />
            <path d="M74 93Q80 87 86 93Q80 98 74 93Z" fill="#ff8c9a" />
            <path d="M15 39L18 31L21 39L29 42L21 45L18 53L15 45L7 42Z" fill="#ffc800" />
            <path d="M140 29L143 22L146 29L153 32L146 35L143 42L140 35L133 32Z" fill="#ffc800" />
          </>
        ) : mood === 'sad' ? (
          <>
            <path d="M72 79L80 91L88 79Z" fill="#ff9600" stroke="#e58200" strokeWidth="2" strokeLinejoin="round" />
            <path d="M72 103Q80 94 88 103" stroke="#823700" strokeWidth="3" strokeLinecap="round" />
          </>
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
