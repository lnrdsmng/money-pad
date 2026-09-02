<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('app:reconcile-legacy-data')]
#[Description('Command description')]
class ReconcileLegacyData extends Command
{
    /**
     * Execute the console command.
     */
    public function handle()
    {
        //
    }
}
