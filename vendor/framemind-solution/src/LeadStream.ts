import { SafetyShield } from './SafetyShield.js';
import type { ExtractedLead, LeadDispatchResult, LeadRecord, LearningEvent, LearningSink } from './types.js';

export interface LeadDispatcher {
  readonly id: string;
  dispatch(lead: LeadRecord): Promise<LeadDispatchResult>;
}

export class InMemoryLeadDispatcher implements LeadDispatcher {
  readonly id = 'in-memory-lead-dispatcher';
  readonly dispatched: LeadRecord[] = [];

  async dispatch(lead: LeadRecord): Promise<LeadDispatchResult> {
    this.dispatched.push(lead);
    return {
      success: true,
      leadId: lead.leadId,
      recipient: 'in-memory-queue',
    };
  }
}

export class LeadStream {
  constructor(
    private readonly domain: string,
    private readonly dispatcher: LeadDispatcher,
    private readonly learningSink?: LearningSink,
  ) {}

  /**
   * Transforms an extracted lead into a structured LeadRecord with full details
   * for authorized delivery (Stream 1).
   */
  createRecord(extracted: ExtractedLead, metadata?: Record<string, unknown>): LeadRecord {
    const leadId = 'lead_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    return {
      leadId,
      timestamp: new Date(),
      domain: this.domain,
      type: extracted.type || 'general',
      contact: {
        name: extracted.name,
        phone: extracted.phone,
        email: extracted.email,
      },
      details: {
        childYear: extracted.childYear,
        service: extracted.service,
        notes: extracted.notes,
        ...(metadata || {}),
      },
    };
  }

  /**
   * Transforms a LeadRecord into a 100% PII-free LearningEvent (Stream 2).
   * Strips all personal names, phone numbers, and emails.
   */
  static toSafeLearningEvent(lead: LeadRecord): LearningEvent {
    return {
      kind: 'conversion',
      payload: {
        domain: lead.domain,
        type: lead.type,
        childYear: lead.details.childYear,
        service: lead.details.service,
        hasPhone: !!lead.contact.phone,
        hasEmail: !!lead.contact.email,
        timestamp: lead.timestamp.toISOString(),
      },
    };
  }

  /**
   * Dual-stream processing:
   * 1. Stream 1: Delivers full contact info directly to club/business owner.
   * 2. Stream 2: Emits anonymized conversion metrics to learning sink (Zero PII).
   */
  async processInput(text: string, contextHint?: string): Promise<{ handled: boolean; lead?: LeadRecord }> {
    const extracted = SafetyShield.extractLead(text, contextHint);
    if (!extracted.validLead) {
      return { handled: false };
    }

    const record = this.createRecord(extracted);

    // Stream 1: Dispatch to authorized recipient
    await this.dispatcher.dispatch(record);

    // Stream 2: Anonymized learning signal
    if (this.learningSink) {
      const safeEvent = LeadStream.toSafeLearningEvent(record);
      await this.learningSink.record(safeEvent);
    }

    return { handled: true, lead: record };
  }
}
