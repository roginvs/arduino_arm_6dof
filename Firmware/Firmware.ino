#include "./VarSpeedServo/VarSpeedServo.cpp"

#define SERVO_COUNT 6

VarSpeedServo myservo[SERVO_COUNT]; // create servo object to control a servo
// twelve servo objects can be created on most boards

int pos = 0; // variable to store the servo position

void setup()
{
    Serial.begin(9600);
    Serial.print("Starting\n");

    for (int i = 0; i < SERVO_COUNT; i++)
    {
        myservo[i].attach(8 + i);
    };

    for (int i = 0; i < SERVO_COUNT; i++)
    {
        myservo[i].write(90, 100);
    };

    Serial.setTimeout(3000);

    Serial.print("READY\n");
}

int charToVal(char c)
{
    if (c >= '0' && c <= '9')
    {
        return c - '0';
    }
    else if (c >= 'a' && c <= 'f')
    {
        return c - 'a' + 0xA;
    }
    else if (c >= 'A' && c <= 'F')
    {
        return c - 'A' + 0xA;
    }
    else
    {
        return 0;
    }
}

void loop()
{
    //Serial.print("What do you want?\n");

    if (Serial.available() > 0)
    {
        String str = Serial.readStringUntil('\n');
        // Serial.print("You wrote: ");
        // Serial.print(str);
        // Serial.print("\n");

        // M5a64--------------------
        // M1e64--------------------
        // M9604--------------------

        if (str[0] == 'M' && str.length() == (1 + SERVO_COUNT * 4))
        {

            for (int servo_id = 0; servo_id < SERVO_COUNT; servo_id++)
            {
                int offset = servo_id * 4 + 1;

                if (str[offset] == '-')
                {
                    continue;
                };
                int degree = charToVal(str[offset]) * 16 + charToVal(str[offset + 1]);
                int speed = charToVal(str[offset + 2]) * 16 + charToVal(str[offset + 3]);
                /*
                Serial.print("Servo ");
                Serial.print(servo_id);
                Serial.print(" degree=");
                Serial.print(degree);
                Serial.print(" speed=");
                Serial.print(speed);
                Serial.print("\n");
                */
                myservo[servo_id].write(degree, speed);
            };

            for (int i = 0; i < SERVO_COUNT; i++)
            {
                myservo[i].wait();
            };
            Serial.print("OK\n");
        }
        else
        {
            Serial.print("ERR: Unknown command\n");
        };
    };
}
