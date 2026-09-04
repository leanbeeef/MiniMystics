import React, { ChangeEvent, FormEvent, useState } from 'react';
import { Box, Button, FormGroup, H3, Input, Label, Select, Text, TextArea } from '@adminjs/design-system';
import { ApiClient, type ActionProps, useNotice } from 'adminjs';

const api = new ApiClient();

const AdjustBalance = ({ action, record, resource }: ActionProps) => {
  const sendNotice = useNotice();
  const [currency, setCurrency] = useState('COINS');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!record) return <Text>Player profile not found.</Text>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.recordAction({
        resourceId: resource.id,
        recordId: record.id,
        actionName: action.name,
        method: 'post',
        data: { currency, amount: Number(amount), reason },
      });
      if (response.data.notice) sendNotice(response.data.notice);
      if (response.data.redirectUrl) window.location.assign(response.data.redirectUrl);
    } catch (error) {
      sendNotice({ message: error instanceof Error ? error.message : 'Adjustment failed.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box as="form" onSubmit={submit} variant="white" padding="xxl" maxWidth="720px">
      <H3>Audited balance adjustment</H3>
      <Text marginBottom="xl">
        Player {record.params.userId}. This updates the balance and creates both economy and admin audit records.
      </Text>
      <FormGroup>
        <Label>Currency</Label>
        <Select
          value={{ value: currency, label: currency === 'COINS' ? 'Coins' : 'Premium currency' }}
          options={[
            { value: 'COINS', label: 'Coins' },
            { value: 'PREMIUM', label: 'Premium currency' },
          ]}
          onChange={(option) => setCurrency(String(option?.value ?? 'COINS'))}
        />
      </FormGroup>
      <FormGroup>
        <Label>Amount (use a negative number to remove currency)</Label>
        <Input
          type="number"
          step="1"
          required
          value={amount}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setAmount(event.target.value)}
        />
      </FormGroup>
      <FormGroup>
        <Label>Reason (required, at least 8 characters)</Label>
        <TextArea
          required
          minLength={8}
          value={reason}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setReason(event.target.value)}
        />
      </FormGroup>
      <Button type="submit" variant="contained" disabled={submitting}>
        {submitting ? 'Applying…' : 'Apply adjustment'}
      </Button>
    </Box>
  );
};

export default AdjustBalance;
