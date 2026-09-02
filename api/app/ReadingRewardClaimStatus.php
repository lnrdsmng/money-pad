<?php

namespace App;

enum ReadingRewardClaimStatus: string
{
    case AwaitingAd = 'awaiting_ad';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
}
