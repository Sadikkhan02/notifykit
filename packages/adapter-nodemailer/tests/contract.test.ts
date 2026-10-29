import { vi } from 'vitest';
import type { Transporter } from 'nodemailer';
import { runAdapterContractTests } from '@notifykit/test-utils';
import { NodemailerEmailProvider, metadata } from '../src/index.js';

runAdapterContractTests({
  providerName: 'nodemailer',
  channel: 'email',
  metadata,
  createSuccessProvider: () => {
    const mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({ messageId: 'smtp-msg-contract-001' }),
    } as unknown as Transporter;
    return new NodemailerEmailProvider({ transporter: mockTransporter });
  },
  createAuthFailingProvider: () => {
    const mockTransporter = {
      sendMail: vi
        .fn()
        .mockRejectedValue(
          new Error('Invalid login: 535-5.7.8 Username and Password not accepted'),
        ),
    } as unknown as Transporter;
    return new NodemailerEmailProvider({ transporter: mockTransporter });
  },
  createNetworkFailingProvider: () => {
    const mockTransporter = {
      sendMail: vi.fn().mockRejectedValue(new Error('connect ECONNRESET 127.0.0.1:587')),
    } as unknown as Transporter;
    return new NodemailerEmailProvider({ transporter: mockTransporter });
  },
  createInvalidInputProvider: () => {
    const error = Object.assign(new Error('No recipients defined'), { code: 'EENVELOPE' });
    const mockTransporter = {
      sendMail: vi.fn().mockRejectedValue(error),
    } as unknown as Transporter;
    return new NodemailerEmailProvider({ transporter: mockTransporter });
  },
  validOptions: {
    to: 'recipient@example.com',
    from: 'sender@example.com',
    subject: 'Contract test subject',
    html: '<p>Contract test html body</p>',
  },
  invalidOptions: {
    to: '',
    from: 'sender@example.com',
    subject: 'Contract test subject',
    html: '<p>Contract test html body</p>',
  },
  sampleSecret: 'super-secret-smtp-password-xyz',
});
