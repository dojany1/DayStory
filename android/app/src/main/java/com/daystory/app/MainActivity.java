package com.daystory.app;

import android.os.Bundle;

import com.daystory.app.widget.DayStoryWidgetPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DayStoryWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
