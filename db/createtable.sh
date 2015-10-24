#!/bin/sh
mysql -umrqd -pmrqd123 mrqd <`dirname $0`/init.sql
