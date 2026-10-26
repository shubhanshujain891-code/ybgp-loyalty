/**
 * YBGP Loyalty - Automated Integration & Logic Test Suite
 * Tests: Tenant Isolation, Idempotency, Stamp Awards, Redemptions, Reversals, Security
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dbService, normalizeIndianPhone, maskPhone, hashToken } from '../services/db';
import { User } from '../types';

describe('YBGP Loyalty SaaS Core Engine', () => {
  beforeEach(() => {
    dbService.resetToSeed();
  });

  describe('Phone Normalization & Privacy', () => {
    it('normalizes various Indian phone formats correctly to +91XXXXXXXXXX', () => {
      expect(normalizeIndianPhone('9876543210')).toBe('+919876543210');
      expect(normalizeIndianPhone('09876543210')).toBe('+919876543210');
      expect(normalizeIndianPhone('+919876543210')).toBe('+919876543210');
      expect(normalizeIndianPhone('919876543210')).toBe('+919876543210');
    });

    it('masks phone numbers to prevent privacy leakage', () => {
      expect(maskPhone('9876543210')).toBe('+91 ••••• ••210');
    });

    it('creates deterministic hashes for QR verification', () => {
      const h1 = hashToken('YBGP-CRD-TEST1234');
      const h2 = hashToken('YBGP-CRD-TEST1234');
      expect(h1).toBe(h2);
      expect(h1).toContain('h_');
    });
  });

  describe('Customer Registration & DPDP Consent', () => {
    it('registers a new customer and issues a digital stamp card', () => {
      const result = dbService.registerCustomer({
        businessId: 'biz_chaico',
        name: 'Amitabh Sen',
        phone: '9830099887',
        consentGiven: true,
      });

      expect(result.isNew).toBe(true);
      expect(result.customer.phoneNormalized).toBe('+919830099887');
      expect(result.card.businessId).toBe('biz_chaico');
      expect(result.card.currentStamps).toBe(0);
      expect(result.card.qrTokenRaw).toContain('YBGP-CRD-');
    });

    it('rejects registration without DPDP consent', () => {
      expect(() => {
        dbService.registerCustomer({
          businessId: 'biz_chaico',
          name: 'Anonymous User',
          phone: '9830099887',
          consentGiven: false,
        });
      }).toThrow('DPDP consent is required');
    });

    it('returns existing card on returning registration with same phone', () => {
      const reg1 = dbService.registerCustomer({
        businessId: 'biz_chaico',
        name: 'Deepa Rao',
        phone: '9900112233',
        consentGiven: true,
      });

      const reg2 = dbService.registerCustomer({
        businessId: 'biz_chaico',
        name: 'Deepa Rao',
        phone: '9900112233',
        consentGiven: true,
      });

      expect(reg1.customer.id).toBe(reg2.customer.id);
      expect(reg1.card.id).toBe(reg2.card.id);
      expect(reg2.isNew).toBe(false);
    });
  });

  describe('Stamp Awards & Idempotency', () => {
    const cashier: User = {
      id: 'usr_cashier_chai',
      name: 'Rohit Verma',
      email: 'rohit@chaico.in',
      phone: '+919820033445',
      role: 'cashier',
      businessId: 'biz_chaico',
      createdAt: '2026-02-10T09:00:00Z',
    };

    it('awards a stamp and increments card count', () => {
      const cardBefore = dbService.getCustomerCard('cust_tanvi');
      const initialStamps = cardBefore!.currentStamps;

      const result = dbService.awardStamps({
        businessId: 'biz_chaico',
        cardId: 'crd_tanvi_chai',
        staffUser: cashier,
        locationId: 'loc_chai_indiranagar',
        stampsToAward: 1,
      });

      expect(result.success).toBe(true);
      expect(result.card.currentStamps).toBe(initialStamps + 1);
      expect(result.transaction.stampsAwarded).toBe(1);
    });

    it('enforces idempotency and prevents double-award on duplicate request', () => {
      const key = 'idem_test_duplicate_award_99';

      const res1 = dbService.awardStamps({
        businessId: 'biz_chaico',
        cardId: 'crd_tanvi_chai',
        staffUser: cashier,
        locationId: 'loc_chai_indiranagar',
        stampsToAward: 1,
        idempotencyKey: key,
      });

      const res2 = dbService.awardStamps({
        businessId: 'biz_chaico',
        cardId: 'crd_tanvi_chai',
        staffUser: cashier,
        locationId: 'loc_chai_indiranagar',
        stampsToAward: 1,
        idempotencyKey: key,
      });

      expect(res1.transaction.id).toBe(res2.transaction.id);
      expect(res2.card.currentStamps).toBe(res1.card.currentStamps);
    });

    it('unlocks reward when customer reaches stamp threshold', () => {
      // crd_ananya_chai starts with 7 of 8 stamps
      const res = dbService.awardStamps({
        businessId: 'biz_chaico',
        cardId: 'crd_ananya_chai',
        staffUser: cashier,
        locationId: 'loc_chai_indiranagar',
        stampsToAward: 1,
      });

      expect(res.rewardUnlocked).toBe(true);
      expect(res.card.currentStamps).toBe(8);
      expect(res.card.cardStatus).toBe('completed');
    });
  });

  describe('Tenant Isolation Enforcement', () => {
    const salonCashier: User = {
      id: 'usr_salon_cashier',
      name: 'Karan Salon',
      email: 'karan@royalshave.in',
      phone: '+919811122999',
      role: 'cashier',
      businessId: 'biz_royalshave', // Different business!
      createdAt: '2026-02-15T14:00:00Z',
    };

    it('rejects cross-tenant stamp award attempt', () => {
      expect(() => {
        dbService.awardStamps({
          businessId: 'biz_chaico', // Target business
          cardId: 'crd_ananya_chai',
          staffUser: salonCashier, // Staff from Royal Shave
          locationId: 'loc_chai_indiranagar',
          stampsToAward: 1,
        });
      }).toThrow('Unauthorized: Staff member does not belong to this business');
    });

    it('cannot award stamps with card belonging to another business', () => {
      expect(() => {
        dbService.awardStamps({
          businessId: 'biz_royalshave', // Salon tries to pass Chai & Co card
          cardId: 'crd_ananya_chai',
          staffUser: salonCashier,
          locationId: 'loc_salon_kora',
          stampsToAward: 1,
        });
      }).toThrow('Loyalty card not found or belongs to another business');
    });
  });

  describe('Reward Redemption', () => {
    const manager: User = {
      id: 'usr_mgr_chai',
      name: 'Priya Iyer',
      email: 'priya@chaico.in',
      phone: '+919820022334',
      role: 'manager',
      businessId: 'biz_chaico',
      createdAt: '2026-02-05T12:00:00Z',
    };

    it('successfully redeems reward for completed card and deducts stamps', () => {
      // crd_rahul_chai has 8 stamps
      const res = dbService.redeemReward({
        businessId: 'biz_chaico',
        cardId: 'crd_rahul_chai',
        rewardId: 'rwd_chaico_1',
        staffUser: manager,
        locationId: 'loc_chai_indiranagar',
      });

      expect(res.success).toBe(true);
      expect(res.redemption.redemptionCode).toContain('YBGP-RWD-');
      expect(res.card.currentStamps).toBe(0); // 8 - 8 = 0
    });

    it('prevents double-redemption when stamps are exhausted', () => {
      // First redemption drains stamps
      dbService.redeemReward({
        businessId: 'biz_chaico',
        cardId: 'crd_rahul_chai',
        rewardId: 'rwd_chaico_1',
        staffUser: manager,
        locationId: 'loc_chai_indiranagar',
      });

      // Second attempt must fail!
      expect(() => {
        dbService.redeemReward({
          businessId: 'biz_chaico',
          cardId: 'crd_rahul_chai',
          rewardId: 'rwd_chaico_1',
          staffUser: manager,
          locationId: 'loc_chai_indiranagar',
        });
      }).toThrow('Insufficient stamps');
    });
  });

  describe('Stamp Reversals & Audit Control', () => {
    const cashier: User = {
      id: 'usr_cashier_chai',
      name: 'Rohit Verma',
      email: 'rohit@chaico.in',
      phone: '+919820033445',
      role: 'cashier',
      businessId: 'biz_chaico',
      createdAt: '2026-02-10T09:00:00Z',
    };

    const owner: User = {
      id: 'usr_owner_chai',
      name: 'Vikram Sengupta',
      email: 'vikram@chaico.in',
      phone: '+919820011223',
      role: 'owner',
      businessId: 'biz_chaico',
      createdAt: '2026-02-01T11:30:00Z',
    };

    it('blocks cashier from reversing stamp transactions without authorization', () => {
      expect(() => {
        dbService.reverseStampTransaction({
          businessId: 'biz_chaico',
          transactionId: 'tx_st_1',
          reversalReason: 'Accidental double scan',
          staffUser: cashier,
        });
      }).toThrow('Permission denied: Cashiers cannot reverse transactions');
    });

    it('requires a mandatory reversal reason of at least 5 characters', () => {
      expect(() => {
        dbService.reverseStampTransaction({
          businessId: 'biz_chaico',
          transactionId: 'tx_st_1',
          reversalReason: 'no',
          staffUser: owner,
        });
      }).toThrow('detailed reversal reason');
    });

    it('allows owner to reverse with compensating transaction entry and updates balance', () => {
      const cardBefore = dbService.getCustomerCard('cust_ananya')!;
      const stampsBefore = cardBefore.currentStamps;

      const res = dbService.reverseStampTransaction({
        businessId: 'biz_chaico',
        transactionId: 'tx_st_1',
        reversalReason: 'Order was refunded due to item cancellation',
        staffUser: owner,
      });

      expect(res.success).toBe(true);
      expect(res.compensatingTransaction.stampsAwarded).toBe(-1);
      expect(res.compensatingTransaction.type).toBe('reversal');
      expect(res.card.currentStamps).toBe(stampsBefore - 1);
    });
  });
});
