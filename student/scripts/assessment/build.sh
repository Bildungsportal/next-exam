#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
swiftc "$DIR/main.swift" \
  -o "$DIR/assessment-helper" \
  -framework AutomaticAssessmentConfiguration
echo "Built: $DIR/assessment-helper"