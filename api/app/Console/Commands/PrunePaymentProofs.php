<?php

namespace App\Console\Commands;

use App\Models\PlanPurchase;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

#[Signature('moneypad:prune-payment-proofs')]
#[Description('Delete reviewed payment proof images after the configured retention period')]
class PrunePaymentProofs extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $cutoff = now()->subDays((int) config('moneypad.payments.proof_retention_days'));
        $deleted = 0;

        PlanPurchase::query()
            ->whereNotNull('payment_proof_path')
            ->whereNotNull('reviewed_at')
            ->where('reviewed_at', '<=', $cutoff)
            ->lazyById(100)
            ->each(function (PlanPurchase $purchase) use (&$deleted): void {
                Storage::disk('payment_proofs')->delete($purchase->getRawOriginal('payment_proof_path'));
                $purchase->update(['payment_proof_path' => null]);
                $deleted++;
            });

        $this->info("Deleted {$deleted} expired payment proof(s).");

        return self::SUCCESS;
    }
}
