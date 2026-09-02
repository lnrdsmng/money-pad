<?php

namespace App;

enum PlanPurchaseStatus: string
{
    case Pending = 'pending';
    case PendingReview = 'pending_review';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Paid = 'paid';
    case Failed = 'failed';
    case Cancelled = 'cancelled';
}
