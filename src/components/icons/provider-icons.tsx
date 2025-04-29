
import React from 'react';

export interface IconProps {
  className?: string;
}

export const GoogleDriveIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.433 22h15.135c.32 0 .595-.225.675-.53l2.175-9.65a.68.68 0 0 0-.12-.585.645.645 0 0 0-.555-.235H8.097l-2.38-4.7a.69.69 0 0 0-.62-.38H.758a.688.688 0 0 0-.675.535.687.687 0 0 0 .148.68l4.716 6.53-1.64 7.285c-.08.36.148.72.5.84.09.02.188.03.282.03h.344v.18zM23.61 11.67l-3.038-5.488a.689.689 0 0 0-.614-.345h-5.646c-.364 0-.675.27-.675.63 0 .12.033.24.102.344l2.95 5.528h6.921v-.668zm-6.858 10.33h6.858c.32 0 .596-.225.676-.53l1.55-6.87h-6.32l-2.764 7.4z" fill="currentColor" />
  </svg>
);

export const DropboxIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 2l6 3.75L6 9.5 0 5.75 6 2zm12 0l6 3.75-6 3.75-6-3.75L18 2zM0 14.25L6 10.5l6 3.75L6 18l-6-3.75zm18 0l6-3.75v7.5L18 22l-6-3.75 6-4zm-6-5.5L18 5l6 3.75-6 3.75-6-3.75z" fill="currentColor" />
  </svg>
);

export const OneDriveIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.08 13.06c1.44.32 2.5 1.32 2.5 2.58 0 1.47-1.28 2.67-2.87 2.67H7.33c-1.8 0-3.27-1.32-3.27-2.96 0-1.47 1.18-2.7 2.72-2.92.02-.05.04-.11.06-.16-.02-.09-.03-.18-.03-.27 0-1.15 1.06-2.07 2.36-2.07.94 0 1.76.48 2.13 1.19.3-.77 1.14-1.31 2.13-1.31.88 0 1.66.4 2.04 1.03.12-.04.25-.07.39-.07.52 0 .97.22 1.25.55.41-.43 1-2.19 1.25-2.98.25-.85 1.24-1.47 2.41-1.47 1.38 0 2.5.95 2.5 2.12 0 .11-.02.21-.04.31.77.35 1.27 1.03 1.27 1.8 0 .86-.6 1.58-1.4 1.9-.2.31-.47.59-.8.84-.19-.04-.4-.07-.62-.07-.4 0-.76.08-1.1.22l.03-.01z" fill="currentColor" />
  </svg>
);

export const BoxIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.505 3.317l-8.59 5.08.01 7.16 8.59 5.08 8.59-5.08V8.397l-8.59-5.08zm0 1.633l5.74 3.395-5.74 3.396-5.74-3.396 5.74-3.395zm-6.847 9.591l.007-5.395 6.09 3.604v6.894l-6.097-3.605v-1.498z" fill="currentColor" fillRule="evenodd"/>
  </svg>
);

export const AmazonS3Icon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.3944 2.5C16.9299 2.5 17.3652 2.93533 17.3652 3.47085V20.5291C17.3652 21.0647 16.9299 21.5 16.3944 21.5H7.60586C7.07035 21.5 6.63501 21.0647 6.63501 20.5291V3.47085C6.63501 2.93533 7.07035 2.5 7.60586 2.5H16.3944ZM12.212 16.3368C12.4151 16.3368 12.6118 16.4151 12.7591 16.5624C13.0537 16.857 13.0537 17.3308 12.7591 17.6254C12.6118 17.7727 12.4151 17.851 12.212 17.851C12.0089 17.851 11.8122 17.7727 11.6649 17.6254C11.3704 17.3308 11.3704 16.857 11.6649 16.5624C11.8122 16.4151 12.0089 16.3368 12.212 16.3368Z" fill="currentColor" />
    <path fillRule="evenodd" clipRule="evenodd" d="M3.5 7.60559C3.5 7.07007 3.93533 6.63474 4.47085 6.63474H5.66441V8.57644H4.47085C3.93533 8.57644 3.5 8.14112 3.5 7.60559Z" fill="currentColor"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M20.5291 15.4232C21.0647 15.4232 21.5 15.8585 21.5 16.394V17.5876H19.5583V16.394C19.5583 15.8585 19.9936 15.4232 20.5291 15.4232Z" fill="currentColor"/>
  </svg>
);

export const BackblazeIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.58 2L9.22 11.98H14.69L12.41 22L20 8.35H14.35L17.11 2H11.58Z" fill="currentColor" />
  </svg>
);

export const MegaIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L4.5 9.5V22h5v-9h5v9h5V9.5L12 2z" fill="currentColor" />
  </svg>
);

export const PCloudIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.456 10.06c-.184-3.052-2.72-5.48-5.824-5.48-2.507 0-4.606 1.577-5.416 3.777-2.33.044-4.2 1.934-4.2 4.284 0 2.37 1.903 4.282 4.248 4.282h10.918c2.135 0 3.868-1.74 3.868-3.883 0-2.012-1.513-3.665-3.489-3.858l-.105-.123z" fill="currentColor" />
  </svg>
);

export const YandexDiskIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M12.782 2h-1.564L4.5 14.333h2.267l1.534-2.999H15.7l1.533 3h2.267L12.782 2zm-3.368 7.667L12 3.833l2.586 5.834H9.414z" fill="currentColor" />
    <path d="M4.5 16.667h15v4.666H4.5v-4.666z" fill="currentColor" />
  </svg>
);

export const IcedriveIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L4 6v12l8 4 8-4V6l-8-4zm0 2.5L16.5 8 12 11.5 7.5 8 12 4.5zm-6 4.33L10.5 12 6 15.17V8.83zM13.5 12L18 8.83v6.34L13.5 12z" fill="currentColor" />
  </svg>
);

export const SyncIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.5 14h-9v-1.5h9V16zm-4.5-5.81v3.12h-1.5v-3.12L7.5 7.56h1.72l2.03 2.03 2.03-2.03H15l-3 2.63z" fill="currentColor" />
  </svg>
);
