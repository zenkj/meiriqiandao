#!/bin/sh

mysqldump -umrqd -pmrqd123 mrqd >`dirname $0`/bak/db-`date +%F`.bak
