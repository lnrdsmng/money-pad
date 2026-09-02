<?php

namespace App;

enum ReadingRewardStatus: string
{
    case Pending = 'pending';
    case Claimed = 'claimed';
    case Expired = 'expired';
}
