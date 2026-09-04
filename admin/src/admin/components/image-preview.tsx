import React from 'react';
import { Box, Label, Link, Text } from '@adminjs/design-system';
import type { ShowPropertyProps } from 'adminjs';

const ImagePreview = ({ property, record }: ShowPropertyProps) => {
  const value = String(record.params[property.path] ?? '').trim();
  const baseUrl = String(property.custom?.baseUrl ?? '').replace(/\/$/, '');
  const source = value.startsWith('http://') || value.startsWith('https://')
    ? value
    : value && baseUrl
      ? `${baseUrl}/${value.replace(/^\//, '')}`
      : '';

  return (
    <Box marginBottom="xl">
      <Label>{property.label}</Label>
      {!source ? (
        <Text>{value || 'No approved image available.'}</Text>
      ) : (
        <Box>
          <img
            src={source}
            alt={`${property.label} preview`}
            style={{ display: 'block', maxHeight: 360, maxWidth: '100%', objectFit: 'contain', marginBottom: 8 }}
          />
          <Link href={source} target="_blank" rel="noreferrer">Open original</Link>
        </Box>
      )}
    </Box>
  );
};

export default ImagePreview;
