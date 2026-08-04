package com.mxrvs.steptracker

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

class StepCounterService : Service(), SensorEventListener {
  private lateinit var sensorManager: SensorManager
  private var stepCounter: Sensor? = null

  override fun onCreate() {
    super.onCreate()
    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!hasActivityPermission(this) || stepCounter == null) {
      stopSelf()
      return START_NOT_STICKY
    }

    StepTrackerStore.setEnabled(this, true)
    startInForeground()
    sensorManager.registerListener(
      this,
      stepCounter,
      SensorManager.SENSOR_DELAY_NORMAL
    )
    ActivityWidgetProvider.updateAll(this)
    return START_STICKY
  }

  override fun onSensorChanged(event: SensorEvent) {
    if (event.sensor.type != Sensor.TYPE_STEP_COUNTER) return

    val delta = StepTrackerStore.recordSensorTotal(this, event.values[0].toInt())
    if (delta <= 0) return

    val steps = StepTrackerStore.getSteps(this)
    val now = System.currentTimeMillis()
    if (StepTrackerStore.shouldRefreshWidget(this, steps, now)) {
      ActivityWidgetProvider.updateAll(this)
      updateNotification(steps)
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  override fun onDestroy() {
    sensorManager.unregisterListener(this)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun startInForeground() {
    val notification = buildNotification(StepTrackerStore.getSteps(this))
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        notification,
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
          android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
        } else {
          0
        }
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun updateNotification(steps: Int) {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(NOTIFICATION_ID, buildNotification(steps))
  }

  private fun buildNotification(steps: Int): android.app.Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent =
      launchIntent?.let {
        PendingIntent.getActivity(
          this,
          0,
          it,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
      }

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_menu_directions)
      .setContentTitle("mxrvs daily activity")
      .setContentText("%,d steps today".format(steps))
      .setContentIntent(pendingIntent)
      .setOnlyAlertOnce(true)
      .setOngoing(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Daily step tracking",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Keeps the low-power device pedometer active."
      setSound(null, null)
      enableVibration(false)
    }
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(channel)
  }

  companion object {
    private const val CHANNEL_ID = "mxrvs_daily_steps"
    private const val NOTIFICATION_ID = 7312

    fun hasActivityPermission(context: Context): Boolean =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
        ContextCompat.checkSelfPermission(
          context,
          Manifest.permission.ACTIVITY_RECOGNITION
        ) == PackageManager.PERMISSION_GRANTED

    fun isSensorAvailable(context: Context): Boolean {
      val manager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
      return manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
    }

    fun start(context: Context) {
      if (!hasActivityPermission(context) || !isSensorAvailable(context)) return
      StepTrackerStore.setEnabled(context, true)
      ContextCompat.startForegroundService(
        context,
        Intent(context, StepCounterService::class.java)
      )
    }

    fun startIfPermitted(context: Context) {
      if (StepTrackerStore.isEnabled(context) || hasActivityPermission(context)) {
        start(context)
      }
    }

    fun stop(context: Context) {
      StepTrackerStore.setEnabled(context, false)
      context.stopService(Intent(context, StepCounterService::class.java))
      ActivityWidgetProvider.updateAll(context)
    }
  }
}
