package com.ugandaweather.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class WidgetUtilsTest {

    @Test
    public void readsTwelveHourClockTextFromTheApi() {
        assertEquals(Integer.valueOf(6 * 60 + 43), WidgetUtils.clockMinutes("6:43 am"));
        assertEquals(Integer.valueOf(18 * 60 + 52), WidgetUtils.clockMinutes("6:52 pm"));
        assertEquals(Integer.valueOf(30), WidgetUtils.clockMinutes("12:30 AM"));
        assertEquals(Integer.valueOf(12 * 60 + 5), WidgetUtils.clockMinutes("12:05 pm"));
    }

    @Test
    public void readsTwentyFourHourClockText() {
        assertEquals(Integer.valueOf(6 * 60 + 45), WidgetUtils.clockMinutes("06:45"));
        assertEquals(Integer.valueOf(18 * 60 + 52), WidgetUtils.clockMinutes("18:52"));
    }

    @Test
    public void rejectsClockTextItCannotRead() {
        assertNull(WidgetUtils.clockMinutes(null));
        assertNull(WidgetUtils.clockMinutes(""));
        assertNull(WidgetUtils.clockMinutes("soon"));
        assertNull(WidgetUtils.clockMinutes("25:00"));
        assertNull(WidgetUtils.clockMinutes("13:00 pm"));
        assertNull(WidgetUtils.clockMinutes("6:75 am"));
    }

    @Test
    public void worksOutDaylightFromSunriseAndSunset() {
        assertEquals("Daylight 12h 09m", WidgetUtils.formatDaylight("6:43 am", "6:52 pm"));
    }

    @Test
    public void hidesDaylightWhenEitherTimeIsMissingOrOutOfOrder() {
        assertNull(WidgetUtils.formatDaylight(null, "6:52 pm"));
        assertNull(WidgetUtils.formatDaylight("6:43 am", null));
        assertNull(WidgetUtils.formatDaylight("6:52 pm", "6:43 am"));
    }

    @Test
    public void labelsRainfallPatternsLikeTheWebsite() {
        assertEquals("Two rainy seasons a year", WidgetUtils.rainfallPatternLabel("bimodal"));
        assertEquals("One long rainy season a year", WidgetUtils.rainfallPatternLabel("unimodal"));
        assertNull(WidgetUtils.rainfallPatternLabel(null));
        assertNull(WidgetUtils.rainfallPatternLabel("unknown"));
    }
}
