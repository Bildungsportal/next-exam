#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
swiftc "$DIR/assessment.swift" \
  -o "$DIR/assessment-helper" \
  -framework AutomaticAssessmentConfiguration
echo "Built: $DIR/assessment-helper"
swiftc "$DIR/wifi.swift" \
  -o "$DIR/wifi-helper" \
  -framework CoreWLAN \
  -framework CoreLocation
echo "Built: $DIR/wifi-helper"
